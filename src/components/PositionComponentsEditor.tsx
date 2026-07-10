import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Clock, PlusCircle, Trash2, Search, Link2 } from "lucide-react";
import {
  type PositionComponent,
  calcComponentZeile,
  calcPositionPreis,
  EMPTY_COMPONENT,
} from "@/lib/positionen";

/**
 * Komponenten-Editor einer Position (kalkulierte Leistung) — nach der Excel
 * "Z_Kalkulation Vorlage 2026 Material und Positionen":
 *   + Material    → Zeile mit Menge/EH x EK x (1+Verschnitt%) x (1+Aufschlag%)
 *   + Arbeitszeit → Std/EH x Stundensatz
 *   + Sonstiges   → Pauschalbetrag/EH
 * Verknüpfte Materialien ziehen ihren EK LIVE aus dem Katalog — Preisänderung
 * am Material wirkt automatisch auf alle Positionen (DB-Trigger).
 */

export interface MaterialOption {
  id: string;
  name: string;
  einheit: string;
  ek_netto: number;
  kategorie: string;
}

interface Props {
  components: PositionComponent[];
  onChange: (next: PositionComponent[]) => void;
  /** Einheit der Position (z.B. m2) — für Beschriftungen. */
  einheit: string;
  /** Materialien (art='material') aus dem Katalog für den Picker. */
  materialien: MaterialOption[];
}

const fmt = (n: number) => n.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PositionComponentsEditor({ components, onChange, einheit, materialien }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const ekLookup = useMemo(() => {
    const m: Record<string, number> = {};
    for (const mat of materialien) m[mat.id] = mat.ek_netto;
    return m;
  }, [materialien]);

  const summe = useMemo(() => calcPositionPreis(components, ekLookup), [components, ekLookup]);

  const update = (idx: number, patch: Partial<PositionComponent>) => {
    onChange(components.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const remove = (idx: number) => {
    onChange(components.filter((_, i) => i !== idx).map((c, i) => ({ ...c, sort_order: i })));
  };
  const addMaterial = (mat: MaterialOption) => {
    onChange([
      ...components,
      {
        ...EMPTY_COMPONENT("material", components.length),
        material_template_id: mat.id,
        bezeichnung: mat.name,
        einheit: mat.einheit,
        menge_pro_einheit: 1,
        preis: mat.ek_netto,
        verschnitt_prozent: 0,
        aufschlag_prozent: 18, // üblicher Material-Aufschlag laut Excel (1,18)
      },
    ]);
    setPickerOpen(false);
    setPickerSearch("");
  };
  const addFrei = (typ: "material" | "lohn" | "sonstiges") => {
    onChange([...components, EMPTY_COMPONENT(typ, components.length)]);
  };

  const num = (v: string) => {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const gefilterte = materialien.filter(m => {
    const s = pickerSearch.toLowerCase();
    return !s || m.name.toLowerCase().includes(s) || m.kategorie.toLowerCase().includes(s);
  });

  return (
    <div className="border-2 border-primary/30 bg-primary/5 rounded-lg p-3 space-y-3">
      <div>
        <Label className="font-semibold text-primary text-base">🧮 Kalkulation — Komponenten</Label>
        <p className="text-xs text-muted-foreground">
          Die Position besteht aus Materialien + Arbeitszeit. Verknüpfte Materialien ziehen ihren
          EK automatisch aus dem Katalog. Alle Mengen gelten <b>pro {einheit || "Einheit"}</b>.
        </p>
      </div>

      {components.length > 0 && (
        <div className="space-y-2">
          {/* Kopfzeile */}
          <div className="hidden md:grid grid-cols-[1fr_90px_90px_70px_70px_90px_32px] gap-1.5 px-1 text-[11px] text-muted-foreground">
            <span>Komponente</span>
            <span>Menge/{einheit || "EH"}</span>
            <span>EK € / Satz</span>
            <span>Verschn. %</span>
            <span>Aufschl. %</span>
            <span className="text-right">Zeile €</span>
            <span></span>
          </div>
          {components.map((c, idx) => {
            const linked = !!c.material_template_id;
            const ek = linked ? ekLookup[c.material_template_id!] : undefined;
            const zeile = calcComponentZeile(c, ek);
            return (
              <div key={idx} className="grid grid-cols-2 md:grid-cols-[1fr_90px_90px_70px_70px_90px_32px] gap-1.5 items-center bg-background rounded-md border p-1.5">
                <div className="col-span-2 md:col-span-1 flex items-center gap-1.5 min-w-0">
                  {c.typ === "lohn" ? (
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  ) : c.typ === "sonstiges" ? (
                    <PlusCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                  {linked ? (
                    <span className="text-sm truncate flex items-center gap-1" title={`Mit Katalog verknüpft — EK folgt dem Material (aktuell € ${fmt(ek ?? c.preis)})`}>
                      {c.bezeichnung}
                      <Link2 className="w-3 h-3 text-primary/60 shrink-0" />
                    </span>
                  ) : (
                    <Input
                      value={c.bezeichnung}
                      onChange={(e) => update(idx, { bezeichnung: e.target.value })}
                      placeholder={c.typ === "lohn" ? "Arbeitszeit" : c.typ === "sonstiges" ? "z.B. Kleinmaterial" : "Materialname"}
                      className="h-8 text-sm"
                    />
                  )}
                </div>
                <Input
                  type="number" step="any" inputMode="decimal"
                  value={c.menge_pro_einheit === 0 ? "" : c.menge_pro_einheit}
                  onChange={(e) => update(idx, { menge_pro_einheit: num(e.target.value) })}
                  placeholder="0" className="h-8 text-sm text-right"
                  title={c.typ === "lohn" ? `Stunden pro ${einheit || "EH"}` : `Menge pro ${einheit || "EH"}`}
                />
                <Input
                  type="number" step="any" inputMode="decimal"
                  value={linked ? (ek ?? c.preis) : (c.preis === 0 ? "" : c.preis)}
                  onChange={(e) => update(idx, { preis: num(e.target.value) })}
                  disabled={linked}
                  placeholder="0" className="h-8 text-sm text-right"
                  title={c.typ === "lohn" ? "Stundensatz €/h" : "EK € pro Einheit"}
                />
                {c.typ === "material" ? (
                  <>
                    <Input
                      type="number" step="any" inputMode="decimal"
                      value={c.verschnitt_prozent === 0 ? "" : c.verschnitt_prozent}
                      onChange={(e) => update(idx, { verschnitt_prozent: num(e.target.value) })}
                      placeholder="0" className="h-8 text-sm text-right"
                    />
                    <Input
                      type="number" step="any" inputMode="decimal"
                      value={c.aufschlag_prozent === 0 ? "" : c.aufschlag_prozent}
                      onChange={(e) => update(idx, { aufschlag_prozent: num(e.target.value) })}
                      placeholder="0" className="h-8 text-sm text-right"
                    />
                  </>
                ) : (
                  <>
                    <div className="hidden md:block" />
                    <div className="hidden md:block" />
                  </>
                )}
                <span className="text-sm font-mono text-right tabular-nums">{fmt(zeile)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(idx)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setPickerOpen(true)}>
          <Package className="w-4 h-4" /> + Material
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => addFrei("lohn")}>
          <Clock className="w-4 h-4" /> + Arbeitszeit
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => addFrei("sonstiges")}>
          <PlusCircle className="w-4 h-4" /> + Sonstiges
        </Button>
      </div>

      {components.length > 0 && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Materialkosten</span>
            <span className="text-right tabular-nums">{fmt(summe.material)} €</span>
            <span className="text-muted-foreground">Lohnkosten ({fmt(summe.minutenProEinheit / 60)} h/{einheit || "EH"})</span>
            <span className="text-right tabular-nums">{fmt(summe.lohn)} €</span>
            {summe.sonstiges > 0 && (
              <>
                <span className="text-muted-foreground">Sonstiges</span>
                <span className="text-right tabular-nums">{fmt(summe.sonstiges)} €</span>
              </>
            )}
            <span className="font-semibold border-t pt-1 mt-1">Einzelpreis / {einheit || "EH"}</span>
            <span className="text-right font-semibold tabular-nums border-t pt-1 mt-1 text-primary">
              {fmt(summe.einzelpreis)} €
            </span>
          </div>
        </div>
      )}

      {/* Material-Picker */}
      <Dialog open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) setPickerSearch(""); }}>
        <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Material aus Katalog wählen</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Material suchen..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="overflow-y-auto flex-1 space-y-0.5 border rounded-md p-1.5 min-h-[200px]">
            {gefilterte.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">
                Kein Material gefunden. Materialien werden im Tab „Materialien" gepflegt.
              </p>
            ) : (
              gefilterte.slice(0, 200).map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => addMaterial(m)}
                  className="w-full flex items-center gap-2 p-2 rounded hover:bg-accent text-sm text-left"
                >
                  <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="flex-1 truncate">{m.name}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{m.kategorie}</Badge>
                  <span className="text-xs text-muted-foreground shrink-0 w-10 text-center">{m.einheit}</span>
                  <span className="font-mono text-xs shrink-0 w-20 text-right">
                    {m.ek_netto > 0 ? `€ ${fmt(m.ek_netto)}` : "–"}
                  </span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
