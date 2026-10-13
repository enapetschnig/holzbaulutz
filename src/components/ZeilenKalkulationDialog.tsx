import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Loader2, Undo2 } from "lucide-react";
import { PositionComponentsEditor, type MaterialOption } from "@/components/PositionComponentsEditor";
import { type PositionComponent, calcPositionPreis, componentPreis } from "@/lib/positionen";
import type { KalkulationSnapshot } from "@/components/KatalogKalkulationPopover";

/**
 * Kalkulation EINER Angebotszeile anpassen — Stunden und Material direkt beim
 * Angebotschreiben (Wunsch Holzbau Lutz 13.10.2026). Gleicher Komponenten-
 * Editor wie im Katalog; die Änderung gilt nur für diese Zeile, der Katalog
 * bleibt unberührt. Wer die geänderte Kalkulation öfter braucht, speichert
 * sie als neue Katalog-Position (Duplikat) oder bearbeitet den Katalog selbst.
 *
 * Gespeichert wird die geänderte Kalkulation im Zeilen-Snapshot
 * (kalkulation_snapshot.angepasst = true) — "Preise aktualisieren"
 * überschreibt solche Zeilen nicht, Materialliste/-bedarf lesen sie von dort.
 */

export interface ZeilenKalkulationErgebnis {
  einzelpreis: number;
  arbeitszeit_minuten: number;
  snapshot: KalkulationSnapshot & { angepasst?: boolean };
  /** Gesetzt, wenn die Zeile auf eine neu angelegte Katalog-Position zeigt. */
  neueTemplateId?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  snapshot: (KalkulationSnapshot & { angepasst?: boolean }) | null | undefined;
  position: number;
  /** Einheit der Angebotszeile (z.B. m²) — Mengen gelten pro Einheit. */
  einheit: string;
  onApply: (r: ZeilenKalkulationErgebnis) => void;
  /** Zurück auf die Katalog-Kalkulation (Snapshot verwerfen). */
  onReset: () => void;
}

const fmt = (n: number) => (Number(n) || 0).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ZeilenKalkulationDialog({ open, onOpenChange, templateId, snapshot, position, einheit, onApply, onReset }: Props) {
  const { toast } = useToast();
  const [comps, setComps] = useState<PositionComponent[]>([]);
  const [materialien, setMaterialien] = useState<MaterialOption[]>([]);
  const [name, setName] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [kopieName, setKopieName] = useState<string | null>(null);
  const [speichertKopie, setSpeichertKopie] = useState(false);

  useEffect(() => {
    if (!open) return;
    let abgebrochen = false;
    setKopieName(null);
    setLaedt(true);
    (async () => {
      const [mRes, tRes, cRes] = await Promise.all([
        (supabase as any).from("invoice_templates")
          .select("id, kurzbezeichnung, name, einheit, ek_netto, kategorie, produktnummer")
          .eq("art", "material").limit(5000),
        (supabase as any).from("invoice_templates")
          .select("kurzbezeichnung, name").eq("id", templateId).maybeSingle(),
        // Schon angepasst → die eigene Zeilen-Kalkulation weiterbearbeiten,
        // sonst vom aktuellen Katalogstand (mit Material-Verknüpfungen) starten.
        snapshot?.angepasst ? Promise.resolve({ data: null }) : (supabase as any).from("position_components")
          .select("material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order")
          .eq("position_template_id", templateId).order("sort_order"),
      ]);
      if (abgebrochen) return;
      setMaterialien(((mRes.data as any[]) || []).map(m => ({
        id: m.id, name: m.kurzbezeichnung || m.name, einheit: m.einheit || "",
        ek_netto: Number(m.ek_netto) || 0, kategorie: m.kategorie || "", produktnummer: m.produktnummer || undefined,
      })));
      setName(snapshot?.name || tRes.data?.kurzbezeichnung || tRes.data?.name || "");
      const quelle: any[] = snapshot?.angepasst ? (snapshot.komponenten as any[]) : ((cRes.data as any[]) || []);
      setComps(quelle.map((c, i) => ({
        material_template_id: c.material_template_id || null,
        typ: c.typ,
        bezeichnung: c.bezeichnung || "",
        einheit: c.einheit || "",
        menge_pro_einheit: Number(c.menge_pro_einheit) || 0,
        preis: Number(c.preis) || 0,
        verschnitt_prozent: Number(c.verschnitt_prozent) || 0,
        aufschlag_prozent: Number(c.aufschlag_prozent) || 0,
        sort_order: i,
      })));
      setLaedt(false);
    })();
    return () => { abgebrochen = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateId]);

  const ekLookup = useMemo(() => {
    const m: Record<string, number> = {};
    for (const mat of materialien) m[mat.id] = mat.ek_netto;
    return m;
  }, [materialien]);
  const summe = useMemo(() => calcPositionPreis(comps, ekLookup), [comps, ekLookup]);

  /** Komponenten mit eingefrorenem EK (verknüpfte Materialien: aktueller Katalog-EK). */
  const eingefroren = () => comps.map((c, i) => ({
    ...c,
    preis: componentPreis(c, c.material_template_id ? ekLookup[c.material_template_id] : undefined),
    sort_order: i,
  }));

  const snapshotAus = (tplId: string, nm: string, angepasst: boolean) => ({
    template_id: tplId,
    name: nm,
    vk_netto: summe.einzelpreis,
    arbeitszeit_minuten: summe.minutenProEinheit,
    stand: new Date().toISOString(),
    komponenten: eingefroren(),
    angepasst,
  });

  const uebernehmen = () => {
    onApply({
      einzelpreis: summe.einzelpreis,
      arbeitszeit_minuten: summe.minutenProEinheit,
      snapshot: snapshotAus(templateId, name, true),
    });
    onOpenChange(false);
  };

  /** Geänderte Kalkulation als NEUE Katalog-Position speichern (Duplikat) und die Zeile darauf umhängen. */
  const alsKatalogKopie = async () => {
    const nm = (kopieName || "").trim();
    if (!nm) return;
    setSpeichertKopie(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data: orig, error: oErr } = await (supabase as any).from("invoice_templates").select("*").eq("id", templateId).maybeSingle();
      if (oErr || !orig || !auth?.user) throw new Error(oErr?.message || "Katalog-Position nicht gefunden");
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = orig;
      const { data: neu, error: iErr } = await (supabase as any).from("invoice_templates").insert({
        ...rest,
        user_id: auth.user.id,
        name: nm,
        kurzbezeichnung: nm,
        produktnummer: null,
        artikelnummer: null,
        foto_path: null,
        ist_favorit: false,
        einzelpreis: summe.einzelpreis,
        netto_preis: summe.einzelpreis,
        vk_netto: summe.einzelpreis,
        brutto_preis: Math.round(summe.einzelpreis * (1 + (Number(orig.ust_satz) || 20) / 100) * 100) / 100,
        arbeitszeit_minuten: summe.minutenProEinheit,
      }).select("id").single();
      if (iErr) throw iErr;
      const kopie = eingefroren();
      if (kopie.length > 0) {
        const { error: cErr } = await (supabase as any).from("position_components").insert(kopie.map(c => ({
          position_template_id: neu.id,
          material_template_id: c.material_template_id,
          typ: c.typ,
          bezeichnung: c.bezeichnung || (c.typ === "lohn" ? "Arbeitszeit" : "Material"),
          einheit: c.einheit || "",
          menge_pro_einheit: c.menge_pro_einheit,
          preis: c.preis,
          verschnitt_prozent: c.verschnitt_prozent,
          aufschlag_prozent: c.aufschlag_prozent,
          sort_order: c.sort_order,
        })));
        if (cErr) {
          await (supabase as any).from("invoice_templates").delete().eq("id", neu.id);
          throw cErr;
        }
      }
      // Die DB rechnet den VK aus den Komponenten (Trigger) — den maßgeblichen Wert lesen.
      const { data: frisch } = await (supabase as any).from("invoice_templates").select("vk_netto, arbeitszeit_minuten").eq("id", neu.id).maybeSingle();
      const vk = Number(frisch?.vk_netto) || summe.einzelpreis;
      const min = Number(frisch?.arbeitszeit_minuten) || summe.minutenProEinheit;
      onApply({
        einzelpreis: vk,
        arbeitszeit_minuten: min,
        snapshot: { ...snapshotAus(neu.id, nm, false), vk_netto: vk, arbeitszeit_minuten: min },
        neueTemplateId: neu.id,
      });
      toast({ title: "Neue Katalog-Position angelegt", description: `„${nm}" steht jetzt im Katalog und ist mit dieser Zeile verknüpft.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Nicht gespeichert", description: e?.message || "Katalog-Position konnte nicht angelegt werden" });
    } finally {
      setSpeichertKopie(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kalkulation anpassen — Pos. {position}{name ? `: ${name}` : ""}</DialogTitle>
          <DialogDescription>
            Stunden und Material nur für <b>dieses Angebot</b> ändern — der Katalog bleibt, wie er ist.
          </DialogDescription>
        </DialogHeader>

        {laedt ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Lädt Kalkulation…</p>
        ) : (
          <PositionComponentsEditor components={comps} onChange={setComps} einheit={einheit} materialien={materialien} />
        )}

        {!laedt && (
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2">
            <span>
              Neuer Einzelpreis: <b className="font-mono">€ {fmt(summe.einzelpreis)}</b> / {einheit || "Einheit"}
              {summe.minutenProEinheit > 0 && <span className="text-muted-foreground"> · {fmt(summe.minutenProEinheit / 60)} h Arbeitszeit</span>}
            </span>
            {snapshot?.vk_netto != null && Math.abs((Number(snapshot.vk_netto) || 0) - summe.einzelpreis) > 0.005 && (
              <span className="text-xs text-muted-foreground">bisher € {fmt(Number(snapshot.vk_netto) || 0)}</span>
            )}
          </div>
        )}

        {kopieName !== null && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2">
            <span className="text-sm">Name der neuen Katalog-Position:</span>
            <Input value={kopieName} onChange={(e) => setKopieName(e.target.value)} className="h-8 flex-1 min-w-[200px]" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void alsKatalogKopie(); } }} />
            <Button size="sm" onClick={alsKatalogKopie} disabled={speichertKopie || !kopieName.trim()} className="gap-1">
              {speichertKopie && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Im Katalog anlegen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setKopieName(null)} disabled={speichertKopie}>Abbrechen</Button>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1" asChild>
              <a href={`/materials?bearbeiten=${templateId}`} target="_blank" rel="noopener noreferrer"
                title="Katalog-Position selbst ändern (neuer Tab) — danach hier „Preise aktualisieren“">
                <ExternalLink className="h-3.5 w-3.5" /> Im Katalog bearbeiten
              </a>
            </Button>
            <Button variant="outline" size="sm" className="gap-1" disabled={laedt || kopieName !== null}
              onClick={() => setKopieName(`${name} (Kopie)`)}
              title="Diese Kalkulation als eigene, neue Position in den Katalog übernehmen">
              <Copy className="h-3.5 w-3.5" /> Als neue Katalog-Position
            </Button>
            {snapshot?.angepasst && (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => { onReset(); onOpenChange(false); }}
                title="Eigene Anpassung verwerfen, Kalkulation wieder aus dem Katalog">
                <Undo2 className="h-3.5 w-3.5" /> Katalog-Stand
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button onClick={uebernehmen} disabled={laedt}>Für diese Zeile übernehmen</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
