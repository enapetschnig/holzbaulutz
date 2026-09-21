import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Search, ChevronDown, ChevronRight } from "lucide-react";

/**
 * Katalog neben dem Beleg — zum Nachschauen, ohne den Editor zu verlassen.
 *
 * Wunsch aus dem Büro (21.09.2026): Während man eine Rechnung erfasst, kann
 * man nicht speichern, um im Katalog etwas nachzusehen. Dieses Fenster liegt
 * rechts NEBEN dem Editor (kein Dialog, keine Sperre): Suchen, Preise, EK,
 * Lieferant, Langtext lesen — der Beleg bleibt bedienbar. Wer will, fügt eine
 * Zeile direkt ein (gleicher Weg wie „Aus Katalog").
 */

export interface KatalogEintrag {
  id: string;
  name: string;
  beschreibung?: string | null;
  kurzbezeichnung?: string | null;
  langbezeichnung?: string | null;
  einheit: string;
  kategorie?: string | null;
  produktgruppe?: string | null;
  produktnummer?: string | null;
  lieferant?: string | null;
  art?: string | null;
  ist_stundensatz?: boolean | null;
  ist_favorit?: boolean | null;
  ek_netto?: number | null;
  vk_netto?: number | null;
  netto_preis?: number | null;
  einzelpreis?: number | null;
  ist_kalkuliert?: boolean | null;
  arbeitszeit_minuten?: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  eintraege: KatalogEintrag[];
  /** Zeile in den Beleg übernehmen — null, wenn der Beleg gesperrt ist. */
  onEinfuegen: ((eintrag: KatalogEintrag, menge: number) => void) | null;
}

type Art = "alle" | "position" | "material" | "stundensatz";

const eur = (n: number | null | undefined) =>
  n == null ? "–" : `€ ${(Number(n) || 0).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const artVon = (t: KatalogEintrag): Exclude<Art, "alle"> =>
  t.ist_stundensatz ? "stundensatz" : t.art === "material" ? "material" : "position";

export function KatalogNachschlagen({ open, onClose, eintraege, onEinfuegen }: Props) {
  const [suche, setSuche] = useState("");
  const [art, setArt] = useState<Art>("alle");
  const [offen, setOffen] = useState<Set<string>>(new Set());
  const [mengen, setMengen] = useState<Record<string, string>>({});

  // Escape schließt — aber nicht, wenn gerade in einem Feld getippt wird,
  // das zum Beleg gehört (Fokus liegt dann außerhalb des Fensters).
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (e.target as HTMLElement)?.closest?.("[data-katalog-fenster]")) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const treffer = useMemo(() => {
    const s = suche.trim().toLowerCase();
    const list = eintraege.filter(t => {
      if (art !== "alle" && artVon(t) !== art) return false;
      if (!s) return true;
      return [t.name, t.kurzbezeichnung, t.langbezeichnung, t.beschreibung, t.produktnummer, t.lieferant, t.kategorie, t.produktgruppe]
        .some(v => v && String(v).toLowerCase().includes(s));
    });
    // Favoriten zuerst, dann alphabetisch
    return list.sort((a, b) => (Number(!!b.ist_favorit) - Number(!!a.ist_favorit)) ||
      (a.kurzbezeichnung || a.name).localeCompare(b.kurzbezeichnung || b.name, "de")).slice(0, 300);
  }, [eintraege, suche, art]);

  if (!open) return null;

  const toggle = (id: string) => setOffen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <aside
      data-katalog-fenster
      data-bildschirmfoto="aus"
      className="fixed right-0 top-0 z-40 flex h-full w-full max-w-[480px] flex-col border-l bg-background shadow-2xl print:hidden"
      aria-label="Katalog nachschlagen"
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="min-w-0">
          <p className="font-semibold leading-tight">Katalog nachschlagen</p>
          <p className="text-[11px] text-muted-foreground">Der Beleg bleibt daneben bedienbar — nichts geht verloren.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} title="Schließen (Esc)">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2 border-b px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input autoFocus value={suche} onChange={e => setSuche(e.target.value)} placeholder="Name, Produktnr., Lieferant, Gruppe …" className="pl-8" />
        </div>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {([["alle", "Alle"], ["position", "Positionen"], ["material", "Materialien"], ["stundensatz", "Stundensätze"]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setArt(v)}
              className={`flex-1 px-2 py-1.5 transition-colors ${art === v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {treffer.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nichts gefunden.</p>
        ) : treffer.map(t => {
          const auf = offen.has(t.id);
          const vk = t.vk_netto ?? t.netto_preis ?? t.einzelpreis;
          const a = artVon(t);
          return (
            <div key={t.id} className="border-b px-3 py-2">
              <button type="button" onClick={() => toggle(t.id)} className="flex w-full items-start gap-2 text-left">
                {auf ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t.ist_favorit && <span title="Favorit">⭐ </span>}{t.kurzbezeichnung || t.name}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[a === "material" ? "Material" : a === "stundensatz" ? "Stundensatz" : "Position", t.produktgruppe || t.kategorie, t.produktnummer && `Nr. ${t.produktnummer}`, t.lieferant]
                      .filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">{eur(vk)}</p>
                  <p className="text-[11px] text-muted-foreground">je {t.einheit}{a === "material" && t.ek_netto != null ? ` · EK ${eur(t.ek_netto)}` : ""}</p>
                </div>
              </button>

              {auf && (
                <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-2 text-xs">
                  {(t.langbezeichnung || t.beschreibung) && (
                    <p className="whitespace-pre-wrap text-muted-foreground">{t.langbezeichnung || t.beschreibung}</p>
                  )}
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <dt className="text-muted-foreground">Verkauf netto</dt><dd className="tabular-nums">{eur(vk)} / {t.einheit}</dd>
                    {t.ek_netto != null && (<><dt className="text-muted-foreground">Einkauf netto</dt><dd className="tabular-nums">{eur(t.ek_netto)} / {t.einheit}</dd></>)}
                    {t.lieferant && (<><dt className="text-muted-foreground">Lieferant</dt><dd>{t.lieferant}</dd></>)}
                    {t.produktnummer && (<><dt className="text-muted-foreground">Produktnr.</dt><dd>{t.produktnummer}</dd></>)}
                    {(t.produktgruppe || t.kategorie) && (<><dt className="text-muted-foreground">Gruppe</dt><dd>{t.produktgruppe || t.kategorie}</dd></>)}
                    {!!t.arbeitszeit_minuten && (<><dt className="text-muted-foreground">Arbeitszeit</dt><dd>{(Number(t.arbeitszeit_minuten) / 60).toLocaleString("de-AT", { maximumFractionDigits: 2 })} h / {t.einheit}</dd></>)}
                    {t.ist_kalkuliert && (<><dt className="text-muted-foreground">Preis</dt><dd>kalkuliert (EK + Aufschlag + Lohn)</dd></>)}
                  </dl>
                  {onEinfuegen && (
                    <div className="flex items-center gap-2 pt-1">
                      <Input type="number" inputMode="decimal" min={0} step="any" value={mengen[t.id] ?? "1"}
                        onChange={e => setMengen(m => ({ ...m, [t.id]: e.target.value }))} className="h-8 w-20 text-right" />
                      <span className="text-muted-foreground">{t.einheit}</span>
                      <Button type="button" size="sm" className="ml-auto h-8 gap-1"
                        onClick={() => onEinfuegen(t, Math.max(0, parseFloat(String(mengen[t.id] ?? "1").replace(",", ".")) || 1))}>
                        <Plus className="h-3.5 w-3.5" /> In den Beleg
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {treffer.length === 300 && <p className="p-3 text-center text-[11px] text-muted-foreground">Nur die ersten 300 Treffer — bitte genauer suchen.</p>}
      </div>
    </aside>
  );
}
