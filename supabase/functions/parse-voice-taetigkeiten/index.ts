// Tätigkeiten diktieren: "Eine Stunde aufräumen, zwei Stunden Stapler richten"
// → [{text:"Aufräumen", stunden:1}, {text:"Stapler richten", stunden:2}]
//
// Gleiche Bauart wie parse-voice-material: Transkription über
// gpt-4o-mini-transcribe (Fallback whisper-1), danach Strukturierung mit
// gpt-4o-mini. Wird von den Bautages- und Regiebericht-Formularen genutzt.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBase64, mimeType }: { audioBase64: string; mimeType?: string } = await req.json();

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: "Audio data required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Spracherkennung ist nicht konfiguriert (OPENAI_API_KEY fehlt)." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log(`Tätigkeiten-Diktat, audio size: ${audioBase64.length} chars`);

    // ── Schritt 1: Transkription ──
    const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
    // iOS/Safari liefert mp4/aac statt webm — Endung passend mitgeben,
    // sonst lehnt die Transkriptions-API die Datei ab.
    const typ = (mimeType || "audio/webm").split(";")[0];
    const endung = typ.includes("mp4") || typ.includes("m4a") ? "mp4"
      : typ.includes("mpeg") || typ.includes("mp3") ? "mp3"
      : typ.includes("wav") ? "wav" : "webm";
    const audioBlob = new Blob([audioBytes], { type: typ });
    // Fach-Kontext hilft dem Modell bei Zimmerei-Begriffen und Stundenangaben
    const kontextPrompt =
      "Zimmerei und Holzbau. Tätigkeiten mit Stundenangaben, z.B. eine Stunde aufräumen, " +
      "zwei Stunden Stapler richten, eineinhalb Stunden Werkzeug sortieren, " +
      "Halle kehren, Maschinen warten, Holz sortieren, Baustelle einrichten, Material laden.";

    const transkribiere = async (model: string) => {
      const formData = new FormData();
      formData.append("file", audioBlob, `audio.${endung}`);
      formData.append("model", model);
      formData.append("language", "de");
      formData.append("prompt", kontextPrompt);
      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`${model}: ${res.status} ${await res.text()}`);
      const j = await res.json();
      return (j.text || "").trim();
    };

    let transcript = "";
    try {
      transcript = await transkribiere("gpt-4o-mini-transcribe");
    } catch (e) {
      console.warn("gpt-4o-mini-transcribe fehlgeschlagen, Fallback whisper-1:", (e as Error).message);
      try {
        transcript = await transkribiere("whisper-1");
      } catch (e2) {
        console.error("Whisper error:", (e2 as Error).message);
        return new Response(
          JSON.stringify({ error: "Transkription fehlgeschlagen", details: (e2 as Error).message }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    }
    console.log("Transcript:", transcript);

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: "Keine Sprache erkannt", transcript: "", items: [] }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // ── Schritt 2: In Tätigkeitszeilen strukturieren ──
    const systemPrompt = `Du erfasst Arbeitszeiten für einen Zimmerei-Betrieb (Holzbau Lutz, Österreich).
Der Benutzer diktiert auf Deutsch, welche Tätigkeiten er wie lange gemacht hat.

AUFGABE: Zerlege den Text in einzelne Tätigkeiten mit Stundenangabe.

REGELN:
1. Jede genannte Tätigkeit wird EINE Zeile mit ihren Stunden.
2. Stunden als Dezimalzahl: "eine Stunde"=1, "zwei Stunden"=2, "zweieinhalb Stunden"=2.5,
   "eine halbe Stunde"=0.5, "eindreiviertel Stunden"=1.75, "45 Minuten"=0.75, "20 Minuten"=0.33,
   "dreiviertel Stunde"=0.75, "anderthalb Stunden"=1.5.
3. Die Tätigkeit als kurzen, sauberen Text schreiben — Verb im Infinitiv oder als Substantiv,
   erster Buchstabe groß, KEINE Stundenangabe im Text.
   Beispiele: "aufgeräumt"→"Aufräumen", "hab den Stapler gerichtet"→"Stapler richten",
   "Halle gekehrt"→"Halle kehren".
4. Nennt der Benutzer keine Stunden zu einer Tätigkeit, setze stunden auf 0
   (der Nutzer ergänzt sie dann im Formular).
5. Erfinde NICHTS dazu. Nur was gesagt wurde.

BEISPIEL
Eingabe: "eine Stunde aufgeräumt und zweieinhalb Stunden den Stapler gerichtet"
Ausgabe: {"items":[{"text":"Aufräumen","stunden":1},{"text":"Stapler richten","stunden":2.5}]}

Antworte NUR mit validem JSON:
{"items":[{"text":"Tätigkeit","stunden":1.5}]}
Erkennst du nichts, antworte: {"items":[]}`;

    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!chatResponse.ok) {
      const err = await chatResponse.text();
      console.error("GPT error:", err);
      return new Response(
        JSON.stringify({ error: "KI-Verarbeitung fehlgeschlagen", transcript, items: [] }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const chatData = await chatResponse.json();
    const content = chatData.choices?.[0]?.message?.content || "{}";
    console.log("GPT response:", content);

    let parsed: { items?: { text?: string; stunden?: number }[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { items: [] };
    }

    // Defensiv säubern: nur echte Zeilen, Stunden auf 0–24 begrenzt
    const items = (parsed.items || [])
      .map(i => ({
        text: String(i?.text ?? "").trim().slice(0, 150),
        stunden: Math.min(24, Math.max(0, Math.round((Number(i?.stunden) || 0) * 100) / 100)),
      }))
      .filter(i => i.text.length > 0);

    return new Response(
      JSON.stringify({ transcript, items }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
