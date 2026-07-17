import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, ArrowRight } from "lucide-react";
import { istArbeitszeitZeile } from "@/lib/stunden";

/**
 * "Stundenlohn anpassen" — NUR für dieses Angebot/diese Rechnung:
 * sammelt alle im Dokument verwendeten Stundensätze (explizite Stunden-
 * Zeilen, kalkulierte Positionen, Lohn-Komponenten aus dem Katalog-Snapshot),
 * lässt je Satz einen neuen Wert eintragen und zeigt VOR dem Übernehmen
 * pro betroffener Position alt → neu. Der Katalog bleibt unberührt.
 */

interface ItemLite {
  position: number;
  beschreibung?: string;
  kurztext?: string;
  einheit?: string;
  menge: number;
  einzelpreis: number;
  ist_kalkuliert?: boolean;
  stundensatz?: number;
  arbeitszeit_minuten?: number;
  kalkulation_snapshot?: any;
  mwst_exempt?: boolean;
}

/** Eine Fundstelle eines Stundensatzes in einer Position. */
interface Treffer {
  itemIndex: number;
  quelle: "zeile" | "kalkuliert" | "snapshot";
  /** Nur bei snapshot: Lohnstunden pro Einheit, die mit diesem Satz laufen. */
  stundenProEinheit?: number;
}

interface SatzGruppe {
  key: string;
  name: string;
  satz: number;
  treffer: Treffer[];
}

export interface StundenlohnUpdate {
  itemIndex: number;
  quelle: Treffer["quelle"];
  alterSatz: number;
  neuerSatz: number;
  stundenProEinheit?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: ItemLite[];
  /** Wendet die Änderungen an (InvoiceDetail rechnet die Preise nach). */
  onApply: (updates: StundenlohnUpdate[]) => void;
}

const fmt = (n: number) => (Number(n) || 0).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nameVon = (it: ItemLite) => it.kurztext || it.beschreibung || `Position ${it.position}`;

/** Alle Stundensatz-Vorkommen im Dokument einsammeln und nach Name+Satz gruppieren. */
function sammleSaetze(items: ItemLite[]): SatzGruppe[] {
  const gruppen = new Map<string, SatzGruppe>();
  const add = (name: string, satz: number, t: Treffer) => {
    if (!(satz > 0)) return;
    const key = `${name.toLowerCase().trim()}|${satz.toFixed(2)}`;
    if (!gruppen.has(key)) gruppen.set(key, { key, name, satz, treffer: [] });
    gruppen.get(key)!.treffer.push(t);
  };

  items.forEach((it, idx) => {
    if (it.mwst_exempt) return; // Abzugszeilen nie anfassen
    // a) Explizite Stunden-Zeile (z.B. "Facharbeiterstunde × 25 Std")
    if (istArbeitszeitZeile(nameVon(it), it.einheit)) {
      add(nameVon(it), Number(it.einzelpreis) || 0, { itemIndex: idx, quelle: "zeile" });
      return;
    }
    // b) Kalkulierte Position (Legacy-Formel mit eigenem Stundensatz)
    if (it.ist_kalkuliert && (Number(it.arbeitszeit_minuten) || 0) > 0 && (Number(it.stundensatz) || 0) > 0) {
      add("Stundensatz (Kalkulation)", Number(it.stundensatz), { itemIndex: idx, quelle: "kalkuliert" });
      return;
    }
    // c) Lohn-Komponenten aus dem Katalog-Snapshot (z.B. Baukran =
    //    30 h Facharbeiterstunde + 6 h LKW mit Hiab)
    const komps = (it.kalkulation_snapshot?.komponenten || []) as any[];
    const lohnByKey = new Map<string, { name: string; satz: number; stunden: number }>();
    for (const k of komps) {
      if (k.typ !== "lohn") continue;
      const satz = Number(k.preis) || 0;
      const stunden = Number(k.menge_pro_einheit) || 0;
      if (!(satz > 0) || !(stunden > 0)) continue;
      const kk = `${String(k.bezeichnung || "Arbeitszeit").toLowerCase().trim()}|${satz.toFixed(2)}`;
      const prev = lohnByKey.get(kk);
      if (prev) prev.stunden += stunden;
      else lohnByKey.set(kk, { name: k.bezeichnung || "Arbeitszeit", satz, stunden });
    }
    for (const l of lohnByKey.values()) {
      add(l.name, l.satz, { itemIndex: idx, quelle: "snapshot", stundenProEinheit: l.stunden });
    }
  });

  return [...gruppen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Neuer Einzelpreis einer Position, wenn ein Satz von alt auf neu geht. */
export function neuerEinzelpreis(it: ItemLite, t: Treffer, alterSatz: number, neuerSatz: number): number {
  const ep = Number(it.einzelpreis) || 0;
  if (t.quelle === "zeile") return neuerSatz;
  if (t.quelle === "snapshot") {
    return Math.round((ep + (neuerSatz - alterSatz) * (t.stundenProEinheit || 0)) * 100) / 100;
  }
  // kalkuliert: Lohnanteil = Minuten/60 × Satz — Differenz aufschlagen
  const stunden = (Number(it.arbeitszeit_minuten) || 0) / 60;
  return Math.round((ep + (neuerSatz - alterSatz) * stunden) * 100) / 100;
}

export function StundenlohnAnpassenDialog({ open, onClose, items, onApply }: Props) {
  const gruppen = useMemo(() => sammleSaetze(items), [items]);
  const [neueWerte, setNeueWerte] = useState<Record<string, string>>({});

  useEffect(() => { if (open) setNeueWerte({}); }, [open]);

  const parse = (v: string) => {
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  // Vorschau: alle Positionen, deren Preis sich durch die Eingaben ändert
  const vorschau = useMemo(() => {
    const zeilen: { position: number; name: string; alt: number; neu: number }[] = [];
    for (const g of gruppen) {
      const neu = parse(neueWerte[g.key] || "");
      if (neu === null || Math.abs(neu - g.satz) < 0.005) continue;
      for (const t of g.treffer) {
        const it = items[t.itemIndex];
        if (!it) continue;
        const alt = zeilen.find(z => z.position === it.position);
        const basisEp = alt ? alt.neu : Number(it.einzelpreis) || 0;
        const neuEp = neuerEinzelpreis({ ...it, einzelpreis: basisEp }, t, g.satz, neu);
        if (alt) alt.neu = neuEp;
        else zeilen.push({ position: it.position, name: nameVon(it), alt: Number(it.einzelpreis) || 0, neu: neuEp });
      }
    }
    return zeilen.sort((a, b) => a.position - b.position);
  }, [gruppen, neueWerte, items]);

  const handleApply = () => {
    const updates: StundenlohnUpdate[] = [];
    for (const g of gruppen) {
      const neu = parse(neueWerte[g.key] || "");
      if (neu === null || Math.abs(neu - g.satz) < 0.005) continue;
      for (const t of g.treffer) {
        updates.push({ itemIndex: t.itemIndex, quelle: t.quelle, alterSatz: g.satz, neuerSatz: neu, stundenProEinheit: t.stundenProEinheit });
      }
    }
    onApply(updates);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Stundenlohn anpassen — nur dieses Dokument
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-md p-2">
          Ändert die Stundensätze <b>nur in diesem Angebot/dieser Rechnung</b> — überall dort,
          wo der jeweilige Satz verwendet wird (Stunden-Zeilen, Kalkulationen, Lohnanteile in
          Katalog-Positionen). Der Katalog selbst bleibt unverändert.
          <br />
          <b>Wichtig:</b> Zuerst alle Positionen/Kalkulationen ins Dokument einfügen, dann den
          Stundenlohn anpassen — später eingefügte Positionen kommen mit dem normalen Katalog-Satz.
        </p>

        {gruppen.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            In diesem Dokument werden keine Stundensätze verwendet.
          </p>
        ) : (
          <div className="space-y-2">
            {gruppen.map(g => (
              <div key={g.key} className="flex items-center gap-3 rounded-md border p-2.5">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    aktuell € {fmt(g.satz)}/h · in {g.treffer.length} Position{g.treffer.length === 1 ? "" : "en"}
                    {" "}(Pos. {[...new Set(g.treffer.map(t => items[t.itemIndex]?.position))].join(", ")})
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    type="number" step="0.5" min={0} inputMode="decimal"
                    className="w-24 h-9 text-right"
                    placeholder={fmt(g.satz)}
                    value={neueWerte[g.key] ?? ""}
                    onChange={(e) => setNeueWerte(v => ({ ...v, [g.key]: e.target.value }))}
                  />
                  <span className="text-xs text-muted-foreground">€/h</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {vorschau.length > 0 && (
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-sm font-semibold mb-1.5">Das wird geändert:</p>
            <ul className="space-y-1 text-sm">
              {vorschau.map(z => (
                <li key={z.position} className="flex justify-between gap-2">
                  <span className="truncate text-muted-foreground">
                    Pos. {z.position} · {z.name.length > 45 ? z.name.slice(0, 45) + "…" : z.name}
                  </span>
                  <span className="font-mono tabular-nums shrink-0">
                    € {fmt(z.alt)} → <b>€ {fmt(z.neu)}</b>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleApply} disabled={vorschau.length === 0} className="gap-1.5">
            <Clock className="w-4 h-4" />
            {vorschau.length > 0
              ? `${vorschau.length} Position${vorschau.length === 1 ? "" : "en"} anpassen`
              : "Anpassen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
