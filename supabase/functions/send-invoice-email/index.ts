import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Rechnung / Angebot (und die übrigen Belegarten) per E-Mail an den Kunden.
 *
 * Das PDF erzeugt der Browser (dieselbe Funktion wie für Vorschau und
 * Download) und schickt es base64-codiert mit — so ist der Anhang garantiert
 * identisch mit dem, was der Nutzer gesehen hat. Hier wird nur versendet und
 * am Beleg vermerkt, wann und an wen.
 *
 * modus "pruefen": ohne Versand nur melden, ob der Mailversand eingerichtet
 * ist (Absender-Domain in Resend bestätigt) — keine Daten, kein Login nötig.
 */

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function absender(): string {
  return Deno.env.get("RESEND_FROM_EMAIL") || "Holzbau Lutz OG <onboarding@resend.dev>";
}

function absenderDomain(): string {
  const m = absender().match(/@([^>\s]+)/);
  return (m?.[1] || "").toLowerCase();
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));

    if (body?.modus === "pruefen") {
      const domain = absenderDomain();
      let verifiziert: boolean | null = false;
      let domainStatus = "";
      let eintraege: string[] = [];
      let faehigkeiten: unknown = null;
      if (resendApiKey && domain && domain !== "resend.dev") {
        const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${resendApiKey}` } });
        // Ein reiner "Sending access"-Key darf die Domains nicht auflisten →
        // unbekannt (null), nicht "falsch".
        if (r.status === 401 || r.status === 403) verifiziert = null;
        if (r.ok) {
          const d = await r.json();
          const eintrag = (d?.data || []).find((x: any) => String(x.name).toLowerCase() === domain);
          verifiziert = eintrag?.status === "verified";
          domainStatus = eintrag ? String(eintrag.status) : "nicht angelegt";
          if (eintrag?.id) {
            const det = await fetch(`https://api.resend.com/domains/${eintrag.id}`, { headers: { Authorization: `Bearer ${resendApiKey}` } });
            if (det.ok) {
              const dd = await det.json();
              eintraege = (dd?.records || []).map((x: any) => `${x.record}/${x.type}: ${x.status}`);
              faehigkeiten = dd?.capabilities ?? null;
              // Zum Versenden zählen nur DKIM/SPF — "Receiving" (Mails AN die
              // Domain empfangen) brauchen wir nicht, Antworten gehen per
              // reply_to ans Büro.
              const senden = (dd?.records || []).filter((x: any) => !/receiving/i.test(String(x.record)));
              verifiziert = senden.length > 0 && senden.every((x: any) => x.status === "verified");
            }
          }
        }
      }
      return json({ eingerichtet: !!resendApiKey, domain, verifiziert, domainStatus, eintraege, faehigkeiten });
    }

    // AUTH: nur angemeldete App-Nutzer (sonst offenes Mail-Relay).
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Nicht angemeldet" }, 401);
    const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !userData?.user) return json({ error: "Ungültige Anmeldung" }, 401);

    if (!resend) {
      return json({ error: "E-Mail-Versand ist noch nicht eingerichtet (RESEND_API_KEY fehlt)." }, 500);
    }

    const { invoiceId, an, kopieAn, betreff, text, pdfBase64, dateiname } = body as {
      invoiceId?: string; an?: string[]; kopieAn?: string[]; betreff?: string; text?: string;
      pdfBase64?: string; dateiname?: string;
    };

    const empfaenger = (an || []).map((s) => String(s).trim()).filter(Boolean);
    const kopie = (kopieAn || []).map((s) => String(s).trim()).filter(Boolean);
    if (!invoiceId || !pdfBase64 || !betreff?.trim()) return json({ error: "Beleg, Betreff oder PDF fehlt." }, 400);
    if (empfaenger.length === 0) return json({ error: "Bitte eine Empfänger-Adresse angeben." }, 400);
    const ungueltig = [...empfaenger, ...kopie].filter((e) => !EMAIL_RE.test(e));
    if (ungueltig.length) return json({ error: `Ungültige E-Mail-Adresse: ${ungueltig.join(", ")}` }, 400);
    if (empfaenger.length + kopie.length > 10) return json({ error: "Zu viele Empfänger." }, 400);

    const { data: inv, error: invErr } = await supabaseAdmin
      .from("invoices")
      .select("id, typ, status, nummer")
      .eq("id", invoiceId)
      .maybeSingle();
    if (invErr || !inv) return json({ error: "Beleg nicht gefunden." }, 404);
    if (String(inv.nummer || "").startsWith("ENTWURF-")) {
      return json({ error: "Ein Entwurf kann nicht versendet werden — bitte zuerst ausstellen." }, 400);
    }

    // Antworten des Kunden landen im Büro.
    const { data: setting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "disturbance_report_email").maybeSingle();
    const buero = (setting?.value as string) || "info@holzbau-lutz.at";

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a;">${
      esc(text || "").replace(/\r?\n/g, "<br>")
    }</div>`;

    const r = await resend.emails.send({
      from: absender(),
      reply_to: buero,
      to: empfaenger,
      ...(kopie.length ? { bcc: kopie } : {}),
      subject: betreff.trim(),
      html,
      text: text || "",
      attachments: [{ filename: dateiname || `${inv.nummer}.pdf`, content: pdfBase64 }],
    });
    if ((r as any)?.error) {
      console.error("Resend-Fehler:", JSON.stringify((r as any).error));
      return json({ error: (r as any).error.message || "E-Mail konnte nicht gesendet werden." }, 502);
    }

    // Versand am Beleg vermerken. Ein Angebot im Entwurf ist damit beim
    // Kunden → "offen (versendet)".
    const update: Record<string, unknown> = { versendet_am: new Date().toISOString(), versendet_an: empfaenger.join(", ") };
    if (inv.typ === "angebot" && inv.status === "entwurf") update.status = "offen";
    const { error: updErr } = await supabaseAdmin.from("invoices").update(update).eq("id", invoiceId);
    if (updErr) console.error("Versand-Vermerk fehlgeschlagen:", updErr.message);

    return json({ success: true, id: (r as any)?.data?.id || null, status: update.status || inv.status, versendet_am: update.versendet_am });
  } catch (e) {
    console.error("send-invoice-email:", e);
    return json({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }, 500);
  }
});
