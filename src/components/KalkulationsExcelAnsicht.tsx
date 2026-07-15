import { useCallback, useEffect, useMemo, useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Package, Clock, PlusCircle, Search, Pencil, Save, Undo2, Link2, Loader2, Plus } from "lucide-react";
import {
  type PositionComponent,
  calcComponentZeile,
  calcPositionPreis,
  componentFormula,
} from "@/lib/positionen";

/**
 * Excel-Gesamtansicht der Kalkulation als INTERAKTIVES Blatt — alle Positionen
 * samt Komponenten, gruppiert nach Kategorie (wie die Arbeitsmappe POSITIONEN).
 * Preise (Menge, EK/Satz, Verschnitt %, Aufschlag %) sind direkt in den Zellen
 * editierbar; Zeilen-Betrag, Positions-Einzelpreis, Kategorie- und Gesamtsumme
 * rechnen live nach — pro Zeile wird die Formel angezeigt. Änderungen werden
 * gesammelt und über eine schwebende Leiste gespeichert (die DB rechnet den VK
 * danach per Trigger identisch nach). Struktur-Änderungen (Komponente hinzu/
 * entfernen/umbenennen) laufen weiter über den Editor-Dialog (Stift-Icon).
 */

interface PositionRow {
  id: string;
  name: string;
  einheit: string;
  kategorie: string;
  vk_netto: number;
  arbeitszeit_minuten: number;
  ust_satz: number;
}

interface Props {
  positionen: PositionRow[];
  onEdit: (id: string) => void;
  /** Nach dem Speichern aufrufen, damit die Eltern-Liste (VKs) neu lädt. */
  onDataChanged?: () => void;
  /** Neue Position in einer Kategorie anlegen (öffnet den Kalkulations-Editor). */
  onAddPosition?: (kategorie: string) => void;
}

type EditComp = PositionComponent & { liveEk: number | null };

const fmt = (n: number) => n.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: string) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const zellInput =
  "h-8 w-full border-0 rounded-none bg-transparent text-right text-xs font-mono tabular-nums shadow-none focus-visible:ring-1 focus-visible:ring-primary px-1";

export function KalkulationsExcelAnsicht({ positionen, onEdit, onDataChanged, onAddPosition }: Props) {
  const { toast } = useToast();
  const [componentsByPos, setComponentsByPos] = useState<Record<string, EditComp[]>>({});
  const [ekLookup, setEkLookup] = useState<Record<string, number>>({});
  const [manualVk, setManualVk] = useState<Record<string, number>>({});
  const [dirtyComp, setDirtyComp] = useState<Set<string>>(new Set());
  const [dirtyVk, setDirtyVk] = useState<Set<string>>(new Set());
  const [suche, setSuche] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("position_components")
      .select(
        "position_template_id, material_template_id, id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order, material:invoice_templates!material_template_id(ek_netto)",
      )
      .order("sort_order")
      .limit(10000);
    const map: Record<string, EditComp[]> = {};
    const eks: Record<string, number> = {};
    for (const c of ((data as any[]) || [])) {
      const liveEk = c.material ? Number(c.material.ek_netto) : null;
      if (c.material_template_id && liveEk != null) eks[c.material_template_id] = liveEk;
      (map[c.position_template_id] = map[c.position_template_id] || []).push({
        id: c.id,
        material_template_id: c.material_template_id,
        typ: c.typ,
        bezeichnung: c.bezeichnung,
        einheit: c.einheit,
        menge_pro_einheit: Number(c.menge_pro_einheit) || 0,
        preis: Number(c.preis) || 0,
        verschnitt_prozent: Number(c.verschnitt_prozent) || 0,
        aufschlag_prozent: Number(c.aufschlag_prozent) || 0,
        sort_order: Number(c.sort_order) || 0,
        liveEk,
      });
    }
    setComponentsByPos(map);
    setEkLookup(eks);
    setManualVk({});
    setDirtyComp(new Set());
    setDirtyVk(new Set());
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await reload(); })();
    return () => { cancelled = true; };
  }, [reload]);

  const updateComp = useCallback((posId: string, idx: number, patch: Partial<PositionComponent>) => {
    setComponentsByPos(prev => ({
      ...prev,
      [posId]: prev[posId].map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
    setDirtyComp(prev => new Set(prev).add(posId));
  }, []);

  const updateVk = useCallback((posId: string, val: number) => {
    setManualVk(prev => ({ ...prev, [posId]: val }));
    setDirtyVk(prev => new Set(prev).add(posId));
  }, []);

  /** Live-VK einer Position: aus Komponenten oder manuell. */
  const livePreis = useCallback((pos: PositionRow): number => {
    const comps = componentsByPos[pos.id];
    if (comps && comps.length > 0) return calcPositionPreis(comps, ekLookup).einzelpreis;
    return manualVk[pos.id] ?? pos.vk_netto;
  }, [componentsByPos, ekLookup, manualVk]);

  const gruppen = useMemo(() => {
    const s = suche.toLowerCase();
    const gefiltert = positionen.filter(p => !s || p.name.toLowerCase().includes(s) || p.kategorie.toLowerCase().includes(s));
    const g: Record<string, PositionRow[]> = {};
    for (const p of gefiltert) (g[p.kategorie] = g[p.kategorie] || []).push(p);
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [positionen, suche]);

  const gesamt = useMemo(
    () => positionen.reduce((s, p) => s + livePreis(p), 0),
    [positionen, livePreis],
  );

  const dirtyCount = dirtyComp.size + dirtyVk.size;

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1) Komponenten-Positionen: geänderte Komponenten aktualisieren.
      for (const posId of dirtyComp) {
        for (const c of (componentsByPos[posId] || [])) {
          if (!c.id) continue;
          const { error } = await (supabase as any)
            .from("position_components")
            .update({
              menge_pro_einheit: c.menge_pro_einheit,
              preis: c.preis,
              verschnitt_prozent: c.verschnitt_prozent,
              aufschlag_prozent: c.aufschlag_prozent,
            })
            .eq("id", c.id);
          if (error) throw new Error(error.message);
        }
      }
      // 2) Positionen ohne Komponenten: manuellen VK direkt schreiben (kein
      //    Trigger — Brutto selbst mitrechnen).
      for (const posId of dirtyVk) {
        const vk = manualVk[posId];
        if (vk == null) continue;
        const ust = positionen.find(p => p.id === posId)?.ust_satz ?? 20;
        const { error } = await (supabase as any)
          .from("invoice_templates")
          .update({
            vk_netto: vk,
            netto_preis: vk,
            einzelpreis: vk,
            brutto_preis: Math.round(vk * (1 + ust / 100) * 100) / 100,
          })
          .eq("id", posId);
        if (error) throw new Error(error.message);
      }
      toast({ title: "Gespeichert", description: `${dirtyCount} Position${dirtyCount === 1 ? "" : "en"} aktualisiert.` });
      setDirtyComp(new Set());
      setDirtyVk(new Set());
      setManualVk({});
      onDataChanged?.();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Speichern fehlgeschlagen", description: e?.message || "Unbekannter Fehler" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-center py-8 text-muted-foreground">Lädt Kalkulation...</p>;

  return (
    <div className="space-y-3 pb-20">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Position oder Kategorie suchen..." value={suche} onChange={(e) => setSuche(e.target.value)} className="pl-10" />
        </div>
        <div className="text-xs text-muted-foreground">
          Gesamt aller Positionen (netto): <b className="font-mono tabular-nums text-foreground">€ {fmt(gesamt)}</b>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-background">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted">
              <th className="border px-2 py-1.5 text-left font-semibold">Position / Komponente</th>
              <th className="border px-2 py-1.5 text-right font-semibold w-24">Menge/EH</th>
              <th className="border px-2 py-1.5 text-right font-semibold w-24">EK € / Satz</th>
              <th className="border px-2 py-1.5 text-right font-semibold w-20">Verschn. %</th>
              <th className="border px-2 py-1.5 text-right font-semibold w-20">Aufschl. %</th>
              <th className="border px-2 py-1.5 text-right font-semibold w-28">Betrag €</th>
              <th className="border px-2 py-1.5 text-center font-semibold w-14">EH</th>
              <th className="border px-2 py-1.5 text-right font-semibold w-32">EP € / EH</th>
            </tr>
          </thead>
          <tbody>
            {gruppen.map(([kategorie, posn]) => {
              const katSumme = posn.reduce((s, p) => s + livePreis(p), 0);
              return (
                <PositionKategorie
                  key={kategorie}
                  kategorie={kategorie}
                  positionen={posn}
                  katSumme={katSumme}
                  componentsByPos={componentsByPos}
                  ekLookup={ekLookup}
                  manualVk={manualVk}
                  dirtyComp={dirtyComp}
                  dirtyVk={dirtyVk}
                  onUpdateComp={updateComp}
                  onUpdateVk={updateVk}
                  onEdit={onEdit}
                  onAddPosition={onAddPosition}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Wie die Excel-Arbeitsmappe POSITIONEN — <b>direkt in den Zellen editierbar</b>. Unter jedem Betrag
        steht die Rechnung (Material = Menge × EK × (1+Verschnitt %) × (1+Aufschlag %) · Arbeitszeit = Std × Satz).
        Verknüpfte Materialien (🔗) ziehen ihren EK aus dem Katalog. Struktur-Änderungen über das Stift-Icon.
      </p>

      {/* Schwebende Speicherleiste */}
      {dirtyCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border bg-background shadow-lg px-4 py-2">
          <span className="text-sm">
            <b>{dirtyCount}</b> Position{dirtyCount === 1 ? "" : "en"} geändert
          </span>
          <Button size="sm" variant="ghost" onClick={reload} disabled={saving} className="gap-1.5">
            <Undo2 className="w-4 h-4" /> Verwerfen
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Speichern
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kategorie-Block (memoisiert je Kategorie über den enthaltenen Positionen)
// ---------------------------------------------------------------------------
interface KatProps {
  kategorie: string;
  positionen: PositionRow[];
  katSumme: number;
  componentsByPos: Record<string, EditComp[]>;
  ekLookup: Record<string, number>;
  manualVk: Record<string, number>;
  dirtyComp: Set<string>;
  dirtyVk: Set<string>;
  onUpdateComp: (posId: string, idx: number, patch: Partial<PositionComponent>) => void;
  onUpdateVk: (posId: string, val: number) => void;
  onEdit: (id: string) => void;
  onAddPosition?: (kategorie: string) => void;
}

function PositionKategorie({ kategorie, positionen, katSumme, componentsByPos, ekLookup, manualVk, dirtyComp, dirtyVk, onUpdateComp, onUpdateVk, onEdit, onAddPosition }: KatProps) {
  return (
    <>
      <tr>
        <td colSpan={7} className="border bg-primary/90 text-primary-foreground px-2 py-1.5 font-semibold text-sm">
          {kategorie} <span className="opacity-70 font-normal">({positionen.length})</span>
        </td>
        <td className="border bg-primary/90 text-primary-foreground px-2 py-1.5 text-right font-mono tabular-nums font-semibold">
          € {fmt(katSumme)}
        </td>
      </tr>
      {positionen.map(p => (
        <PositionBlock
          key={p.id}
          pos={p}
          comps={componentsByPos[p.id]}
          ekLookup={ekLookup}
          manualVkValue={manualVk[p.id]}
          isDirty={dirtyComp.has(p.id) || dirtyVk.has(p.id)}
          onUpdateComp={onUpdateComp}
          onUpdateVk={onUpdateVk}
          onEdit={onEdit}
        />
      ))}
      {onAddPosition && (
        <tr>
          <td colSpan={8} className="border bg-background p-0">
            <button
              type="button"
              onClick={() => onAddPosition(kategorie)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Position in „{kategorie}" hinzufügen
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Eine Position + ihre Komponenten-Zeilen (memoisiert → nur die bearbeitete
// Position rendert bei einer Eingabe neu)
// ---------------------------------------------------------------------------
interface BlockProps {
  pos: PositionRow;
  comps: EditComp[] | undefined;
  ekLookup: Record<string, number>;
  manualVkValue: number | undefined;
  isDirty: boolean;
  onUpdateComp: (posId: string, idx: number, patch: Partial<PositionComponent>) => void;
  onUpdateVk: (posId: string, val: number) => void;
  onEdit: (id: string) => void;
}

const PositionBlock = memo(function PositionBlock({ pos, comps, ekLookup, manualVkValue, isDirty, onUpdateComp, onUpdateVk, onEdit }: BlockProps) {
  const hatKomponenten = !!comps && comps.length > 0;
  const vk = hatKomponenten ? calcPositionPreis(comps!, ekLookup).einzelpreis : (manualVkValue ?? pos.vk_netto);

  return (
    <>
      <tr className={`${isDirty ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted/40"} group`}>
        <td className="border px-2 py-1.5 font-medium" colSpan={5}>
          <span className="flex items-center gap-1.5">
            <button type="button" onClick={() => onEdit(pos.id)} title="Struktur bearbeiten (Komponenten hinzufügen/entfernen)"
              className="text-muted-foreground hover:text-primary shrink-0">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {pos.name}
            {pos.arbeitszeit_minuten > 0 && (
              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 shrink-0">
                {fmt(pos.arbeitszeit_minuten / 60)} h/{pos.einheit}
              </span>
            )}
            {isDirty && <span className="text-[10px] text-amber-700 shrink-0">• geändert</span>}
          </span>
        </td>
        <td className="border px-1 py-0.5 text-right">
          {!hatKomponenten && (
            <Input
              type="number" step="any" inputMode="decimal"
              value={vk === 0 ? "" : vk}
              onChange={(e) => onUpdateVk(pos.id, num(e.target.value))}
              placeholder="0" className={`${zellInput} font-bold text-primary`}
              title="VK netto (Position ohne Komponenten — frei bepreisbar)"
            />
          )}
        </td>
        <td className="border px-2 py-1.5 text-center text-xs text-muted-foreground">{pos.einheit}</td>
        <td className="border px-2 py-1.5 text-right font-bold font-mono tabular-nums text-primary">
          {vk > 0 ? fmt(vk) : "–"}
        </td>
      </tr>
      {(comps || []).map((c, i) => {
        const linked = !!c.material_template_id;
        const ek = linked ? ekLookup[c.material_template_id!] : undefined;
        const betrag = calcComponentZeile(c, ek);
        const isMaterial = c.typ === "material";
        return (
          <tr key={c.id || i} className="text-muted-foreground">
            <td className="border px-2 py-1">
              <span className="flex items-center gap-1.5 pl-5 text-xs">
                {c.typ === "lohn" ? <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                  : c.typ === "sonstiges" ? <PlusCircle className="w-3 h-3 shrink-0" />
                  : <Package className="w-3 h-3 text-primary shrink-0" />}
                {c.bezeichnung}
                {linked && <Link2 className="w-3 h-3 text-primary/60 shrink-0" />}
              </span>
            </td>
            <td className="border p-0">
              <Input
                type="number" step="any" inputMode="decimal"
                value={c.menge_pro_einheit === 0 ? "" : c.menge_pro_einheit}
                onChange={(e) => onUpdateComp(pos.id, i, { menge_pro_einheit: num(e.target.value) })}
                placeholder="0" className={zellInput}
                title={c.typ === "lohn" ? "Stunden pro Einheit" : "Menge pro Einheit"}
              />
            </td>
            <td className={`border p-0 ${linked ? "bg-primary/5" : ""}`}>
              <Input
                type="number" step="any" inputMode="decimal"
                value={linked ? (ek ?? c.preis) : (c.preis === 0 ? "" : c.preis)}
                onChange={(e) => onUpdateComp(pos.id, i, { preis: num(e.target.value) })}
                disabled={linked}
                placeholder="0" className={`${zellInput} disabled:opacity-90`}
                title={c.typ === "lohn" ? "Stundensatz €/h" : linked ? "EK folgt dem Katalog-Material" : "EK € pro Einheit"}
              />
            </td>
            {isMaterial ? (
              <>
                <td className="border p-0">
                  <Input type="number" step="any" inputMode="decimal"
                    value={c.verschnitt_prozent === 0 ? "" : c.verschnitt_prozent}
                    onChange={(e) => onUpdateComp(pos.id, i, { verschnitt_prozent: num(e.target.value) })}
                    placeholder="0" className={zellInput} />
                </td>
                <td className="border p-0">
                  <Input type="number" step="any" inputMode="decimal"
                    value={c.aufschlag_prozent === 0 ? "" : c.aufschlag_prozent}
                    onChange={(e) => onUpdateComp(pos.id, i, { aufschlag_prozent: num(e.target.value) })}
                    placeholder="0" className={zellInput} />
                </td>
              </>
            ) : (
              <>
                <td className="border bg-muted/40"></td>
                <td className="border bg-muted/40"></td>
              </>
            )}
            <td className="border px-2 py-1 text-right font-mono tabular-nums" title={`${componentFormula(c, ek)} = ${fmt(betrag)} €`}>
              <div className="font-medium text-foreground">{fmt(betrag)}</div>
              <div className="text-[9px] text-muted-foreground/70 leading-tight truncate">{componentFormula(c, ek)}</div>
            </td>
            <td className="border px-2 py-1 text-center text-[10px] text-muted-foreground/70">{c.einheit}</td>
            <td className="border p-0"></td>
          </tr>
        );
      })}
    </>
  );
});
