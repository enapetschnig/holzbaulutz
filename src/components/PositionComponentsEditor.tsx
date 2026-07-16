import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Clock, PlusCircle, Trash2, Link2 } from "lucide-react";
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
 *
 * Material-Auswahl: Autocomplete direkt im Bezeichnungs-Feld (gleiche Optik
 * wie in Angebot/Rechnung) — tippen, Vorschlag wählen, verknüpft. Freitext
 * ohne Auswahl bleibt ein unverknüpftes Material.
 */

export interface MaterialOption {
  id: string;
  name: string;
  einheit: string;
  ek_netto: number;
  kategorie: string;
  produktnummer?: string;
}

interface Props {
  components: PositionComponent[];
  onChange: (next: PositionComponent[]) => void;
  /** Einheit der Position (z.B. m2) — für Beschriftungen. */
  einheit: string;
  /** Materialien (art='material') aus dem Katalog für das Autocomplete. */
  materialien: MaterialOption[];
}

const fmt = (n: number) => n.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PositionComponentsEditor({ components, onChange, einheit, materialien }: Props) {
  // Index der Komponenten-Zeile, deren Bezeichnungs-Feld gerade das
  // Autocomplete-Dropdown zeigt (analog autocompleteIdx im Angebots-Editor).
  const [acIdx, setAcIdx] = useState<number | null>(null);

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
  const addFrei = (typ: "material" | "lohn" | "sonstiges") => {
    const neu = EMPTY_COMPONENT(typ, components.length);
    if (typ === "material") neu.aufschlag_prozent = 18; // üblicher Material-Aufschlag laut Excel (1,18)
    onChange([...components, neu]);
    // Material-Zeile: Autocomplete direkt öffnen, sobald getippt wird
    if (typ === "material") setAcIdx(components.length);
  };

  /** Katalog-Material in eine bestehende Zeile übernehmen (verknüpfen). */
  const linkMaterial = (idx: number, mat: MaterialOption) => {
    update(idx, {
      material_template_id: mat.id,
      bezeichnung: mat.name,
      einheit: mat.einheit,
      preis: mat.ek_netto,
    });
    setAcIdx(null);
  };

  const num = (v: string) => {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  /** Autocomplete-Treffer für die Zeile idx (max 8, wie im Angebots-Editor). */
  const acResultsFor = (idx: number): MaterialOption[] => {
    if (acIdx !== idx) return [];
    const c = components[idx];
    if (!c || c.typ !== "material" || c.material_template_id) return [];
    const s = (c.bezeichnung || "").toLowerCase().trim();
    if (!s) return [];
    return materialien
      .filter(m => m.name.toLowerCase().includes(s)
        || m.kategorie.toLowerCase().includes(s)
        || (m.produktnummer || "").toLowerCase().includes(s))
      .slice(0, 8);
  };

  return (
    <div className="border-2 border-primary/30 bg-primary/5 rounded-lg p-3 space-y-3">
      <div>
        <Label className="font-semibold text-primary text-base">🧮 Kalkulation — Komponenten</Label>
        <p className="text-xs text-muted-foreground">
          Die Position besteht aus Materialien + Arbeitszeit. Material einfach eintippen —
          Katalog-Vorschläge erscheinen wie im Angebot; ausgewählte Materialien ziehen ihren
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
                const acResults = acResultsFor(idx);
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
                          <div className="relative flex-1 min-w-0">
                            <Input
                              value={c.bezeichnung}
                              onChange={(e) => { update(idx, { bezeichnung: e.target.value }); if (c.typ === "material") setAcIdx(idx); }}
                              onFocus={() => { if (c.typ === "material") setAcIdx(idx); }}
                              onBlur={() => setTimeout(() => setAcIdx(v => (v === idx ? null : v)), 200)}
                              placeholder={c.typ === "lohn" ? "Arbeitszeit" : c.typ === "sonstiges" ? "z.B. Kleinmaterial" : "Material tippen — Katalog-Vorschläge erscheinen"}
                              className={`${zellInput} text-left px-1`}
                            />
                            {/* Autocomplete-Dropdown — gleiche Optik wie im Angebots-Editor */}
                            {acResults.length > 0 && (
                              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border rounded-md shadow-lg max-h-72 overflow-y-auto">
                                {acResults.map(m => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex justify-between gap-2"
                                    onMouseDown={(e) => { e.preventDefault(); linkMaterial(idx, m); }}
                                  >
                                    <span className="truncate">{m.name}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      {m.produktnummer && <span className="mr-2">{m.produktnummer}</span>}
                                      <span className="mr-2">{m.einheit}</span>
                                      € {fmt(m.ek_netto)}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
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
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => addFrei("material")}>
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
    </div>
  );
}
