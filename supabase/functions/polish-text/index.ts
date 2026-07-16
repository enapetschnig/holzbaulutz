// Diktat → Text für Formularfelder.
// VERLÄSSLICHKEIT VOR SCHÖNHEIT: Der Nutzer muss im Feld wiederfinden, was er
// gesagt hat. Deshalb:
//  1. Transkription mit gpt-4o-mini-transcribe (deutlich genauer für Deutsch),
//     Fallback whisper-1 — beide mit Fach-Kontext-Prompt (Zimmerei/Baustelle).
//  2. "Polish" korrigiert NUR Rechtschreibung/Zeichensetzung/Füllwörter —
//     KEIN Umformulieren, KEINE Ergänzungen. Weicht das Ergebnis zu stark vom
//     Transkript ab, gewinnt das Transkript.
//  3. Anhängen an bestehenden Text macht der CLIENT — die KI bekommt den
//     Bestandstext gar nicht erst zu sehen (kann ihn also nicht verändern).
//  4. Whisper-Halluzinations-Artefakte (Stille → "Vielen Dank." etc.) werden
//     erkannt und als "Keine Sprache erkannt" abgelehnt.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Fach-Kontext verbessert die Erkennung von Handwerks-Begriffen deutlich.
const TRANSCRIBE_PROMPT =
  "Diktat eines österreichischen Zimmerers auf der Baustelle. Fachbegriffe: " +
  "Zimmerei, Holzbau, Dachstuhl, Sparren, Pfette, First, Traufe, Gaube, KVH, " +
  "Konstruktionsvollholz, OSB-Platte, Lattung, Konterlattung, Dampfbremse, " +
  "Unterspannbahn, Aufmaß, Verschnitt, Gewerk, Dämmung, Fassade, Riegelwand, " +
  "Montage, Regiearbeit, Baustelleneinrichtung.";

// Bekannte Whisper-Halluzinationen bei Stille/Rauschen — wenn das Transkript
// NUR daraus besteht, wurde real nichts (Verwertbares) gesagt.
const HALLUCINATION_PATTERNS = [
  /^vielen dank( für.?s zuschauen| fürs zuschauen)?[.!]?$/i,
  /untertitel (im auftrag des zdf|der amara\.org|von)/i,
  /^copyright/i,
  /^das war.?s[.!]?$/i,
  /^bis zum nächsten mal[.!]?$/i,
  /^musik$/i,
  /^\[.*\]$/,
];

const POLISH_SYSTEM_PROMPT = `Du bist ein Diktat-Korrektor für österreichische Handwerker.

Deine EINZIGE Aufgabe: das Transkript minimal bereinigen, OHNE den Inhalt oder die Formulierung zu verändern.

ERLAUBT:
- Rechtschreibung und Zeichensetzung korrigieren
- Reine Füllwörter streichen ("ähm", "äh", "sozusagen")
- Offensichtliche Erkennungsfehler bei Fachbegriffen korrigieren (z.B. "Ozeanplatte" → "OSB-Platte")

VERBOTEN:
- Umformulieren oder Sätze umstellen
- Inhalte ergänzen, ausschmücken oder zusammenfassen
- Wörter durch Synonyme ersetzen
- Meta-Kommentare oder Erklärungen
- Markdown

Gib NUR den bereinigten Text zurück. Im Zweifel: unverändert lassen.`;

async function callChatCompletion(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function transcribeWith(model: string, audioBlob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", audioBlob, "audio.webm");
  form.append("model", model);
  form.append("language", "de");
  form.append("prompt", TRANSCRIBE_PROMPT);
  form.append("response_format", model === "whisper-1" ? "text" : "json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`${model}: ${res.status} ${await res.text()}`);
  if (model === "whisper-1") return (await res.text()).trim();
  const data = await res.json();
  return String(data.text || "").trim();
}

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  // gpt-4o-mini-transcribe ist für Deutsch spürbar genauer als whisper-1;
  // whisper-1 bleibt als Fallback (z.B. falls das Modell nicht verfügbar ist).
  try {
    return await transcribeWith("gpt-4o-mini-transcribe", audioBlob);
  } catch (e) {
    console.warn("gpt-4o-mini-transcribe fehlgeschlagen, Fallback whisper-1:", (e as Error).message);
    return await transcribeWith("whisper-1", audioBlob);
  }
}

function istHalluzination(transcript: string): boolean {
  const t = transcript.trim();
  if (!t) return true;
  return HALLUCINATION_PATTERNS.some((re) => re.test(t));
}

/**
 * Konservatives Schleifen: GPT darf nur minimal korrigieren. Sicherheitsnetz:
 * weicht die Länge des Ergebnisses stark vom Transkript ab (Indiz für
 * Umformulieren/Ausschmücken/Kürzen), gewinnt das ORIGINAL-Transkript.
 */
async function polishConservative(transcript: string): Promise<string> {
  try {
    const polished = await callChatCompletion(POLISH_SYSTEM_PROMPT, transcript);
    if (!polished) return transcript;
    const ratio = polished.length / Math.max(transcript.length, 1);
    if (ratio < 0.6 || ratio > 1.4) {
      console.warn(`Polish verworfen (Längen-Ratio ${ratio.toFixed(2)}) — Transkript beibehalten.`);
      return transcript;
    }
    return polished;
  } catch (e) {
    console.warn("Polish fehlgeschlagen — Transkript unverändert:", (e as Error).message);
    return transcript;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY nicht konfiguriert" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    // --- Multipart: Audio-Datei → Transkript (+ konservatives Schleifen) ---
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const audio = form.get("audio") as File | null;
      const mode = (form.get("mode") as string | null) || "polish"; // "polish" | "raw" ("append" = Alt-Alias für polish)

      if (!audio) {
        return new Response(JSON.stringify({ error: "audio fehlt" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transcript = await transcribeAudio(audio);
      if (istHalluzination(transcript)) {
        return new Response(JSON.stringify({ error: "Keine Sprache erkannt — bitte näher ans Mikrofon und erneut versuchen." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // WICHTIG: Das Anhängen an bestehenden Text macht der Client — hier wird
      // IMMER nur das (bereinigte) neue Diktat zurückgegeben. So kann die KI
      // den Bestandstext prinzipbedingt nicht verändern.
      const text = mode === "raw" ? transcript : await polishConservative(transcript);

      return new Response(JSON.stringify({ success: true, text, transcript }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- JSON: nur Text konservativ bereinigen ---
    const body = await req.json();
    const text = body.text || "";
    if (!text.trim()) {
      return new Response(JSON.stringify({ error: "text fehlt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const polished = await polishConservative(text);
    return new Response(JSON.stringify({ success: true, text: polished }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("polish-text error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
