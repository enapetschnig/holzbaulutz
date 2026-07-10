import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Package, Clock, PlusCircle, Search, Pencil } from "lucide-react";
import { type PositionComponent, calcComponentZeile } from "@/lib/positionen";

/**
 * Excel-Gesamtansicht der Kalkulation — alle Positionen samt Komponenten als
 * EIN durchgehendes Blatt, gruppiert nach Kategorie (wie die Arbeitsmappe
 * POSITIONEN der Vorlage): Rasterlinien, Kategorie-Balken, Komponenten-Zeilen
 * eingerückt unter der Position, Einzelpreis rechts. Nur Ansicht — Klick auf
 * eine Position öffnet den Editor.
 */

interface PositionRow {
  id: string;
  name: string;
  einheit: string;
  kategorie: string;
  vk_netto: number;
  arbeitszeit_minuten: number;
}

interface Props {
  positionen: PositionRow[];
  onEdit: (id: string) => void;
}

const fmt = (n: number) => n.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function KalkulationsExcelAnsicht({ positionen, onEdit }: Props) {
  const [componentsByPos, setComponentsByPos] = useState<Record<string, (PositionComponent & { liveEk: number | null })[]>>({});
  const [suche, setSuche] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("position_components")
        .select("position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order, material:invoice_templates!material_template_id(ek_netto)")
        .order("sort_order");
      if (cancelled) return;
      const map: Record<string, any[]> = {};
      for (const c of ((data as any[]) || [])) {
        (map[c.position_template_id] = map[c.position_template_id] || []).push({
          material_template_id: c.material_template_id,
          typ: c.typ,
          bezeichnung: c.bezeichnung,
          einheit: c.einheit,
          menge_pro_einheit: Number(c.menge_pro_einheit) || 0,
          preis: Number(c.preis) || 0,
          verschnitt_prozent: Number(c.verschnitt_prozent) || 0,
          aufschlag_prozent: Number(c.aufschlag_prozent) || 0,
          sort_order: Number(c.sort_order) || 0,
          liveEk: c.material ? Number(c.material.ek_netto) : null,
        });
      }
      setComponentsByPos(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const gruppen = useMemo(() => {
    const s = suche.toLowerCase();
    const gefiltert = positionen.filter(p => !s || p.name.toLowerCase().includes(s) || p.kategorie.toLowerCase().includes(s));
    const g: Record<string, PositionRow[]> = {};
    for (const p of gefiltert) (g[p.kategorie] = g[p.kategorie] || []).push(p);
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [positionen, suche]);

  if (loading) return <p className="text-center py-8 text-muted-foreground">Lädt Kalkulation...</p>;

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Position oder Kategorie suchen..." value={suche} onChange={(e) => setSuche(e.target.value)} className="pl-10" />
      </div>

      <div className="overflow-x-auto rounded-md border bg-background">
        <table className="w-full text-sm border-collapse min-w-[860px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted">
              <th className="border px-2 py-1.5 text-left font-semibold">Position / Komponente</th>
              <th className="border px-2 py-1.5 text-right font-semibold w-20">Menge/EH</th>
              <th className="border px-2 py-1.5 text-right font-semibold w-24">EK € / Satz</th>
              <th className="border px-2 py-1.5 text-right font-semibold w-20">Verschn. %</th>
              <th className="border px-2 py-1.5 text-right font-semibold w-20">Aufschl. %</th>
              <th className="border px-2 py-1.5 text-right font-semibold w-24">Betrag €</th>
              <th className="border px-2 py-1.5 text-center font-semibold w-16">Einheit</th>
              <th className="border px-2 py-1.5 text-right font-semibold w-28">EP € / EH</th>
            </tr>
          </thead>
          <tbody>
            {gruppen.map(([kategorie, posn]) => (
              [
                <tr key={`k-${kategorie}`}>
                  <td colSpan={8} className="border bg-primary/90 text-primary-foreground px-2 py-1.5 font-semibold text-sm">
                    {kategorie} <span className="opacity-70 font-normal">({posn.length})</span>
                  </td>
                </tr>,
                ...posn.map(p => {
                  const comps = componentsByPos[p.id] || [];
                  return [
                    <tr key={p.id} className="bg-muted/40 hover:bg-muted/70 cursor-pointer group" onClick={() => onEdit(p.id)}>
                      <td className="border px-2 py-1.5 font-medium" colSpan={5}>
                        <span className="flex items-center gap-1.5">
                          {p.name}
                          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                          {p.arbeitszeit_minuten > 0 && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 shrink-0">
                              {fmt(p.arbeitszeit_minuten / 60)} h/{p.einheit}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="border px-2 py-1.5"></td>
                      <td className="border px-2 py-1.5 text-center text-xs text-muted-foreground">{p.einheit}</td>
                      <td className="border px-2 py-1.5 text-right font-bold font-mono tabular-nums text-primary">
                        {p.vk_netto > 0 ? fmt(p.vk_netto) : "–"}
                      </td>
                    </tr>,
                    ...comps.map((c, i) => {
                      const betrag = calcComponentZeile(c, c.liveEk ?? undefined);
                      const preis = c.typ === "material" && c.liveEk !== null ? c.liveEk : c.preis;
                      return (
                        <tr key={`${p.id}-${i}`} className="text-muted-foreground">
                          <td className="border px-2 py-1">
                            <span className="flex items-center gap-1.5 pl-5 text-xs">
                              {c.typ === "lohn" ? <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                : c.typ === "sonstiges" ? <PlusCircle className="w-3 h-3 shrink-0" />
                                : <Package className="w-3 h-3 text-primary shrink-0" />}
                              {c.bezeichnung}
                            </span>
                          </td>
                          <td className="border px-2 py-1 text-right font-mono tabular-nums text-xs">{c.menge_pro_einheit || ""}</td>
                          <td className="border px-2 py-1 text-right font-mono tabular-nums text-xs">{preis ? fmt(preis) : ""}</td>
                          <td className="border px-2 py-1 text-right font-mono tabular-nums text-xs">{c.typ === "material" && c.verschnitt_prozent ? c.verschnitt_prozent : ""}</td>
                          <td className="border px-2 py-1 text-right font-mono tabular-nums text-xs">{c.typ === "material" && c.aufschlag_prozent ? c.aufschlag_prozent : ""}</td>
                          <td className="border px-2 py-1 text-right font-mono tabular-nums text-xs">{fmt(betrag)}</td>
                          <td className="border px-2 py-1"></td>
                          <td className="border px-2 py-1"></td>
                        </tr>
                      );
                    }),
                  ];
                }),
              ]
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Wie die Excel-Arbeitsmappe POSITIONEN: Kategorie-Blöcke, darunter jede Position mit ihren
        Komponenten-Zeilen. Verknüpfte Materialien zeigen den aktuellen Katalog-EK. Klick auf eine
        Position öffnet den Editor.
      </p>
    </div>
  );
}
