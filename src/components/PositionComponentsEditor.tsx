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
  componentFormula,
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
        <div className="overflow-x-auto rounded-md border bg-background">
          {/* Excel-Optik: Rasterlinien, Eingabe direkt in der Zelle, Summen unten */}
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-muted/70">
                <th className="border px-2 py-1.5 text-left font-semibold whitespace-nowrap">Komponente</th>
                <th className="border px-2 py-1.5 text-right font-semibold whitespace-nowrap w-24">Menge/{einheit || "EH"}</th>
                <th className="border px-2 py-1.5 text-right font-semibold whitespace-nowrap w-24">EK € / Satz</th>
                <th className="border px-2 py-1.5 text-right font-semibold whitespace-nowrap w-20">Verschn. %</th>
                <th className="border px-2 py-1.5 text-right font-semibold whitespace-nowrap w-20">Aufschl. %</th>
                <th className="border px-2 py-1.5 text-right font-semibold whitespace-nowrap w-24">Betrag €</th>
                <th className="border w-9"></th>
              </tr>
            </thead>
            <tbody>
              {components.map((c, idx) => {
                const linked = !!c.material_template_id;
                const ek = linked ? ekLookup[c.material_template_id!] : undefined;
                const zeile = calcComponentZeile(c, ek);
                const zellInput = "h-9 w-full border-0 rounded-none bg-transparent text-right text-sm shadow-none focus-visible:ring-1 focus-visible:ring-primary px-2";
                return (
                  <tr key={idx} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                    <td className="border p-0">
                      <div className="flex items-center gap-1.5 pl-2 min-w-0">
                        {c.typ === "lohn" ? (
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ) : c.typ === "sonstiges" ? (
                          <PlusCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                        )}
                        {linked ? (
                          <span className="text-sm truncate py-2 flex items-center gap-1" title={`Mit Katalog verknüpft — EK folgt dem Material (aktuell € ${fmt(ek ?? c.preis)})`}>
                            {c.bezeichnung}
                            <Link2 className="w-3 h-3 text-primary/60 shrink-0" />
                          </span>
                        ) : (
                          <Input
                            value={c.bezeichnung}
                            onChange={(e) => update(idx, { bezeichnung: e.target.value })}
                            placeholder={c.typ === "lohn" ? "Arbeitszeit" : c.typ === "sonstiges" ? "z.B. Kleinmaterial" : "Materialname"}
                            className={`${zellInput} text-left px-1`}
                          />
                        )}
                      </div>
                    </td>
                    <td className="border p-0">
                      <Input
                        type="number" step="any" inputMode="decimal"
                        value={c.menge_pro_einheit === 0 ? "" : c.menge_pro_einheit}
                        onChange={(e) => update(idx, { menge_pro_einheit: num(e.target.value) })}
                        placeholder="0" className={zellInput}
                        title={c.typ === "lohn" ? `Stunden pro ${einheit || "EH"}` : `Menge pro ${einheit || "EH"}`}
                      />
                    </td>
                    <td className={`border p-0 ${linked ? "bg-primary/5" : ""}`}>
                      <Input
                        type="number" step="any" inputMode="decimal"
                        value={linked ? (ek ?? c.preis) : (c.preis === 0 ? "" : c.preis)}
                        onChange={(e) => update(idx, { preis: num(e.target.value) })}
                        disabled={linked}
                        placeholder="0" className={`${zellInput} disabled:opacity-90`}
                        title={c.typ === "lohn" ? "Stundensatz €/h" : linked ? "EK folgt dem Katalog-Material" : "EK € pro Einheit"}
                      />
                    </td>
                    {c.typ === "material" ? (
                      <>
                        <td className="border p-0">
                          <Input
                            type="number" step="any" inputMode="decimal"
                            value={c.verschnitt_prozent === 0 ? "" : c.verschnitt_prozent}
                            onChange={(e) => update(idx, { verschnitt_prozent: num(e.target.value) })}
                            placeholder="0" className={zellInput}
                          />
                        </td>
                        <td className="border p-0">
                          <Input
                            type="number" step="any" inputMode="decimal"
                            value={c.aufschlag_prozent === 0 ? "" : c.aufschlag_prozent}
                            onChange={(e) => update(idx, { aufschlag_prozent: num(e.target.value) })}
                            placeholder="0" className={zellInput}
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="border bg-muted/40"></td>
                        <td className="border bg-muted/40"></td>
                      </>
                    )}
                    <td className="border px-2 py-1 text-right font-mono tabular-nums font-medium"
                        title={`${componentFormula(c, ek)} = ${fmt(zeile)} €`}>
                      <div>{fmt(zeile)}</div>
                      <div className="text-[9px] text-muted-foreground/70 font-normal leading-tight truncate">
                        {componentFormula(c, ek)}
                      </div>
                    </td>
                    <td className="border p-0 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(idx)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 text-xs">
                <td className="border px-2 py-1 text-muted-foreground" colSpan={5}>Materialkosten</td>
                <td className="border px-2 py-1 text-right font-mono tabular-nums">{fmt(summe.material)}</td>
                <td className="border"></td>
              </tr>
              <tr className="bg-muted/30 text-xs">
                <td className="border px-2 py-1 text-muted-foreground" colSpan={5}>
                  Lohnkosten ({fmt(summe.minutenProEinheit / 60)} h/{einheit || "EH"})
                </td>
                <td className="border px-2 py-1 text-right font-mono tabular-nums">{fmt(summe.lohn)}</td>
                <td className="border"></td>
              </tr>
              {summe.sonstiges > 0 && (
                <tr className="bg-muted/30 text-xs">
                  <td className="border px-2 py-1 text-muted-foreground" colSpan={5}>Sonstiges</td>
                  <td className="border px-2 py-1 text-right font-mono tabular-nums">{fmt(summe.sonstiges)}</td>
                  <td className="border"></td>
                </tr>
              )}
              <tr className="bg-primary/10">
                <td className="border px-2 py-2 font-bold" colSpan={5}>Einzelpreis / {einheit || "EH"}</td>
                <td className="border px-2 py-2 text-right font-bold font-mono tabular-nums text-primary">{fmt(summe.einzelpreis)}</td>
                <td className="border"></td>
              </tr>
            </tfoot>
          </table>
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
        <p className="text-[11px] text-muted-foreground">
          Rechnung wie in der Excel: Material = Menge × EK × (1+Verschnitt %) × (1+Aufschlag %) ·
          Arbeitszeit = Std × Satz · Summe = Einzelpreis pro {einheit || "Einheit"}.
        </p>
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
