import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Bereits bezahlte Anzahlung / Teilzahlung von Hand abziehen — für
 * Teilrechnungen, die noch VOR der App (oder außerhalb) gestellt wurden.
 * Wunsch Holzbau Lutz 23.10.2026: „kann kein Minus vor die Position eingeben".
 *
 * Erzeugt dieselbe Netto-Abzugszeile wie der automatische Abzug beim
 * Umwandeln in die Schlussrechnung: negative MENGE (-1) × Netto-Betrag
 * (DB-Check invoice_items_preis_nonneg erlaubt keine negativen Preise). Die
 * USt läuft dann auf den verbleibenden Netto-Rest — § 11 UStG Endrechnung.
 */

export interface AbzugZeile {
  beschreibung: string;
  kurztext: string;
  netto: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mwstSatz: number;
  reverseCharge: boolean;
  onUebernehmen: (z: AbzugZeile) => void;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const euro = (v: number) => v.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const zahl = (s: string) => {
  const n = parseFloat(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.abs(n) : 0;
};

export function AbzugAnzahlungDialog({ open, onOpenChange, mwstSatz, reverseCharge, onUebernehmen }: Props) {
  const [nummer, setNummer] = useState("");
  const [datum, setDatum] = useState("");
  const [betrag, setBetrag] = useState("");
  const [art, setArt] = useState<"brutto" | "netto">("brutto");

  useEffect(() => {
    if (open) { setNummer(""); setDatum(""); setBetrag(""); setArt(reverseCharge ? "netto" : "brutto"); }
  }, [open, reverseCharge]);

  const satz = reverseCharge ? 0 : (Number(mwstSatz) || 0);
  const eingabe = zahl(betrag);
  const netto = art === "brutto" ? r2(eingabe / (1 + satz / 100)) : r2(eingabe);
  const brutto = art === "brutto" ? r2(eingabe) : r2(netto * (1 + satz / 100));
  const ust = r2(brutto - netto);

  const uebernehmen = () => {
    if (!(netto > 0)) return;
    const was = nummer.trim() ? `Anzahlungsrechnung ${nummer.trim()}` : "Teilzahlung";
    const vom = datum ? ` vom ${new Date(datum + "T12:00:00").toLocaleDateString("de-AT")}` : "";
    const zusatz = satz > 0 ? `netto; brutto € ${euro(brutto)} inkl. ${satz}% USt € ${euro(ust)}` : "netto";
    onUebernehmen({
      beschreibung: `abzüglich ${was}${vom} (${zusatz})`,
      kurztext: `Abzug ${nummer.trim() || "Teilzahlung"}`,
      netto,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Anzahlung / Teilzahlung abziehen</DialogTitle>
          <DialogDescription>
            Für Teilrechnungen, die außerhalb der App gestellt wurden. Der Betrag wird netto unter den
            Positionen abgezogen, die USt rechnet sich auf den Rest.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rechnungsnummer (optional)</Label>
              <Input value={nummer} onChange={(e) => setNummer(e.target.value)} placeholder="z.B. 26512" />
            </div>
            <div>
              <Label>vom (optional)</Label>
              <Input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Betrag der Anzahlung</Label>
            <div className="flex gap-2">
              <Input value={betrag} onChange={(e) => setBetrag(e.target.value)} placeholder="0,00" inputMode="decimal" className="text-right" autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); uebernehmen(); } }} />
              {satz > 0 && (
                <div className="flex rounded-md border p-0.5 shrink-0">
                  {(["brutto", "netto"] as const).map(a => (
                    <Button key={a} type="button" size="sm" variant={art === a ? "default" : "ghost"} className="h-8 px-3" onClick={() => setArt(a)}>
                      {a}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {netto > 0 && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-0.5">
              <div className="flex justify-between"><span>Abzug netto</span><b className="font-mono">− € {euro(netto)}</b></div>
              {satz > 0 && <div className="flex justify-between text-muted-foreground"><span>darin enthaltene USt {satz}%</span><span className="font-mono">€ {euro(ust)}</span></div>}
              {satz > 0 && <div className="flex justify-between text-muted-foreground"><span>Anzahlung brutto</span><span className="font-mono">€ {euro(brutto)}</span></div>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={uebernehmen} disabled={!(netto > 0)}>Abzug einfügen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
