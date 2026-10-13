import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Mail, Paperclip, Loader2 } from "lucide-react";
import { getDocConfig } from "@/lib/documentTypes";
import type { InvoiceLayoutCompany } from "@/lib/invoiceLayoutTypes";

/**
 * Beleg (Rechnung, Angebot, …) per E-Mail an den Kunden schicken.
 * Wunsch Holzbau Lutz 13.10.2026: „Rechnungen, Angebote gleich nach dem
 * Speichern per Mail versenden". Das PDF ist exakt das aus Vorschau/Download
 * (buildPdf), versendet wird über die Edge Function send-invoice-email.
 */

export interface BelegMailDaten {
  id: string;
  typ: string;
  nummer: string;
  datum: string;
  betreff?: string;
  brutto: number;
  kunde_name: string;
  kunde_email?: string;
  kunde_anrede?: string;
  kunde_titel?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beleg: BelegMailDaten;
  firma: InvoiceLayoutCompany;
  buildPdf: () => Promise<Blob>;
  onGesendet?: (r: { status?: string; versendet_am?: string; versendet_an: string }) => void;
}

const ARTIKEL: Record<string, string> = {
  angebot: "unser Angebot",
  auftragsbestaetigung: "unsere Auftragsbestätigung",
  rechnung: "unsere Rechnung",
  anzahlungsrechnung: "unsere Anzahlungsrechnung",
  schlussrechnung: "unsere Schlussrechnung",
  lieferschein: "unseren Lieferschein",
  gutschrift: "unsere Gutschrift",
};

const euro = (v: number) => v.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Herr" + "Bernhard Kröll" → "Sehr geehrter Herr Kröll," */
function begruessung(anrede?: string, titel?: string, name?: string): string {
  const nachname = (name || "").trim().split(/\s+/).pop() || "";
  const t = titel?.trim() ? `${titel.trim()} ` : "";
  if (!nachname) return "Sehr geehrte Damen und Herren,";
  if (anrede === "Herr") return `Sehr geehrter Herr ${t}${nachname},`;
  if (anrede === "Frau") return `Sehr geehrte Frau ${t}${nachname},`;
  if (anrede === "Familie") return `Sehr geehrte Familie ${nachname},`;
  return "Sehr geehrte Damen und Herren,";
}

function standardText(b: BelegMailDaten, firma: InvoiceLayoutCompany, absenderName: string): string {
  const art = ARTIKEL[b.typ] || `unser Dokument`;
  const datum = b.datum ? new Date(b.datum + "T12:00:00").toLocaleDateString("de-AT") : "";
  const istRechnung = ["rechnung", "anzahlungsrechnung", "schlussrechnung"].includes(b.typ);
  const kern = b.typ === "angebot"
    ? `vielen Dank für Ihre Anfrage. Im Anhang erhalten Sie ${art} Nr. ${b.nummer} vom ${datum}.\n\nBei Fragen sind wir gerne für Sie da — wir freuen uns auf Ihren Auftrag.`
    : istRechnung
      ? `vielen Dank für Ihren Auftrag. Im Anhang erhalten Sie ${art} Nr. ${b.nummer} vom ${datum} über € ${euro(b.brutto)}.\n\nBei Fragen sind wir gerne für Sie da.`
      : `im Anhang erhalten Sie ${art} Nr. ${b.nummer} vom ${datum}.\n\nBei Fragen sind wir gerne für Sie da.`;
  const signatur = [
    absenderName,
    firma.name,
    [firma.address_line1, firma.address_line2].filter(Boolean).join(", "),
    [firma.phone && `Tel. ${firma.phone}`, firma.email].filter(Boolean).join(" · "),
  ].filter(Boolean).join("\n");
  return `${begruessung(b.kunde_anrede, b.kunde_titel, b.kunde_name)}\n\n${kern}\n\nMit freundlichen Grüßen\n${signatur}`;
}

const blobZuBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1] || "");
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

export function BelegMailDialog({ open, onOpenChange, beleg, firma, buildPdf, onGesendet }: Props) {
  const { toast } = useToast();
  const [an, setAn] = useState("");
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [buero, setBuero] = useState("");
  const [kopieBuero, setKopieBuero] = useState(true);
  const [sendet, setSendet] = useState(false);

  const label = getDocConfig(beleg.typ).label;
  const dateiname = `${label}_${beleg.nummer}.pdf`.replace(/[^\wäöüÄÖÜß.-]+/g, "_");

  // Beim Öffnen vorbefüllen (Kunden-Mail, Betreff, Text mit Signatur).
  useEffect(() => {
    if (!open) return;
    let abgebrochen = false;
    setAn(beleg.kunde_email || "");
    setBetreff(`${label} ${beleg.nummer}${beleg.betreff ? ` – ${beleg.betreff}` : ""} | ${firma.name}`);
    (async () => {
      const [{ data: auth }, { data: setting }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("app_settings").select("value").eq("key", "disturbance_report_email").maybeSingle(),
      ]);
      let absenderName = "";
      if (auth?.user) {
        const { data: p } = await supabase.from("profiles").select("vorname, nachname").eq("id", auth.user.id).maybeSingle();
        absenderName = [p?.vorname, p?.nachname].filter(Boolean).join(" ");
      }
      if (abgebrochen) return;
      setBuero((setting?.value as string) || firma.email || "");
      setText(standardText(beleg, firma, absenderName));
    })();
    return () => { abgebrochen = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const senden = async () => {
    const empfaenger = an.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    if (empfaenger.length === 0) {
      toast({ variant: "destructive", title: "Empfänger fehlt", description: "Bitte die E-Mail-Adresse des Kunden eintragen." });
      return;
    }
    setSendet(true);
    try {
      const pdf = await buildPdf();
      const pdfBase64 = await blobZuBase64(pdf);
      const { data, error } = await supabase.functions.invoke("send-invoice-email", {
        body: {
          invoiceId: beleg.id,
          an: empfaenger,
          kopieAn: kopieBuero && buero ? [buero] : [],
          betreff,
          text,
          pdfBase64,
          dateiname,
        },
      });
      // Bei HTTP-Fehlern steckt die Klartext-Meldung im Response-Body.
      let fehler = (data as any)?.error as string | undefined;
      if (error && !fehler) {
        try { fehler = (await (error as any).context?.json())?.error; } catch { /* ignore */ }
        fehler = fehler || error.message;
      }
      if (fehler) throw new Error(fehler);
      toast({ title: "E-Mail versendet", description: `${label} ${beleg.nummer} ging an ${empfaenger.join(", ")}.` });
      onGesendet?.({ status: (data as any)?.status, versendet_am: (data as any)?.versendet_am, versendet_an: empfaenger.join(", ") });
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "E-Mail nicht versendet", description: e?.message || "Unbekannter Fehler" });
    } finally {
      setSendet(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!sendet) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> {label} per E-Mail senden</DialogTitle>
          <DialogDescription>Das PDF wird automatisch angehängt. Antworten des Kunden kommen ans Büro.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>An</Label>
            <Input value={an} onChange={(e) => setAn(e.target.value)} placeholder="kunde@beispiel.at" type="email" multiple />
            {!beleg.kunde_email && (
              <p className="text-xs text-muted-foreground mt-1">Beim Kunden ist keine E-Mail-Adresse hinterlegt — bitte hier eintragen.</p>
            )}
          </div>
          <div>
            <Label>Betreff</Label>
            <Input value={betreff} onChange={(e) => setBetreff(e.target.value)} />
          </div>
          <div>
            <Label>Nachricht</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} className="font-sans text-sm" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Paperclip className="h-4 w-4" /> {dateiname}</span>
            {buero && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={kopieBuero} onCheckedChange={(v) => setKopieBuero(v === true)} />
                Kopie an {buero}
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sendet}>Abbrechen</Button>
          <Button onClick={senden} disabled={sendet || !betreff.trim()} className="gap-2">
            {sendet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {sendet ? "Wird gesendet…" : "Senden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
