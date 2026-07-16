import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Package, Clock, PlusCircle, Calculator, Undo2, Link2 } from "lucide-react";

/**
 * "Kalkulation dahinter" für Angebots-/Rechnungspositionen aus dem Katalog:
 * zeigt die eingefrorene Komponenten-Kalkulation (Snapshot bei Übernahme) —
 * z.B. Baukran = 30 h Facharbeiterstunde + 6 h LKW mit Hiab. Weicht der
 * Zeilenpreis vom Snapshot ab, kann er auf den ursprünglichen Stand
 * zurückgesetzt werden (Wiederherstellen nach Fehlern/Preis-Updates).
 * Fehlt der Snapshot (ältere Zeilen), wird die Kalkulation live aus dem
 * Katalog geladen.
 */

interface SnapKomponente {
  typ: string;
  bezeichnung: string;
  einheit: string;
  menge_pro_einheit: number;
  preis: number;
  verschnitt_prozent: number;
  aufschlag_prozent: number;
}

export interface KalkulationSnapshot {
  template_id: string;
  name: string;
  vk_netto: number;
  arbeitszeit_minuten: number;
  stand: string;
  komponenten: SnapKomponente[];
}

interface Props {
  templateId: string;
  snapshot: KalkulationSnapshot | null | undefined;
  position: number;
  /** Aktueller Einzelpreis der Zeile — für den Abweichungs-Hinweis. */
  currentEp: number;
  /** Zurücksetzen erlaubt? (nicht bei gesperrten Belegen) */
  canRestore: boolean;
  onRestore: (preis: number) => void;
}

const fmt = (n: number) => (Number(n) || 0).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const zeilenBetrag = (k: SnapKomponente) => {
  const menge = Number(k.menge_pro_einheit) || 0;
  const preis = Number(k.preis) || 0;
  if (k.typ === "material") {
    return menge * preis * (1 + (Number(k.verschnitt_prozent) || 0) / 100) * (1 + (Number(k.aufschlag_prozent) || 0) / 100);
  }
  return menge * preis; // lohn: Std × Satz · sonstiges: Pauschale
};

export function KatalogKalkulationPopover({ templateId, snapshot, position, currentEp, canRestore, onRestore }: Props) {
  const [live, setLive] = useState<KalkulationSnapshot | null>(null);
  const [liveVk, setLiveVk] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const daten = snapshot || live;

  // Beim Öffnen: fehlenden Snapshot live aus dem Katalog holen + aktuellen
  // Katalog-VK für den "Katalog inzwischen geändert"-Hinweis laden.
  const handleOpen = async (open: boolean) => {
    if (!open || loading || (daten && liveVk != null)) return;
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.all([
        (supabase as any).from("invoice_templates")
          .select("kurzbezeichnung, name, vk_netto, arbeitszeit_minuten").eq("id", templateId).maybeSingle(),
        snapshot ? Promise.resolve({ data: null }) : (supabase as any).from("position_components")
          .select("typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent")
          .eq("position_template_id", templateId).order("sort_order"),
      ]);
      const t = tRes.data;
      if (t) setLiveVk(Number(t.vk_netto) || 0);
      if (!snapshot && t) {
        setLive({
          template_id: templateId,
          name: t.kurzbezeichnung || t.name,
          vk_netto: Number(t.vk_netto) || 0,
          arbeitszeit_minuten: Number(t.arbeitszeit_minuten) || 0,
          stand: "",
          komponenten: ((cRes.data as any[]) || []) as SnapKomponente[],
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const snapVk = daten ? Number(daten.vk_netto) || 0 : 0;
  const abweicht = daten && Math.abs(currentEp - snapVk) > 0.005;
  const katalogAbweicht = snapshot && liveVk != null && Math.abs(liveVk - snapVk) > 0.005;

  return (
    <Popover onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 md:h-8 md:w-8 text-primary/70"
          title="Kalkulation aus dem Katalog anzeigen (Komponenten dahinter)">
          <Calculator className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[440px] max-w-[92vw]" align="end">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-primary" />
              Kalkulation aus dem Katalog — Pos. {position}
            </p>
            {snapshot?.stand && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                Stand {new Date(snapshot.stand).toLocaleDateString("de-AT")}
              </span>
            )}
          </div>

          {loading && !daten && <p className="text-xs text-muted-foreground py-3 text-center">Lädt Kalkulation…</p>}

          {daten && (
            daten.komponenten.length > 0 ? (
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {daten.komponenten.map((k, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-1 pr-1">
                        {k.typ === "lohn" ? <Clock className="w-3 h-3 text-amber-600" />
                          : k.typ === "sonstiges" ? <PlusCircle className="w-3 h-3 text-muted-foreground" />
                          : <Package className="w-3 h-3 text-primary" />}
                      </td>
                      <td className="py-1 pr-2">{k.bezeichnung}</td>
                      <td className="py-1 pr-2 text-right whitespace-nowrap text-muted-foreground">
                        {fmt(Number(k.menge_pro_einheit) || 0)} {k.einheit || (k.typ === "lohn" ? "h" : "")} × € {fmt(Number(k.preis) || 0)}
                        {k.typ === "material" && (Number(k.verschnitt_prozent) || Number(k.aufschlag_prozent)) ? (
                          <span className="text-[10px]">
                            {Number(k.verschnitt_prozent) ? ` +${k.verschnitt_prozent}% V` : ""}
                            {Number(k.aufschlag_prozent) ? ` +${k.aufschlag_prozent}% A` : ""}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1 text-right font-mono tabular-nums whitespace-nowrap">€ {fmt(zeilenBetrag(k))}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} className="pt-1.5 font-semibold">Einzelpreis laut Kalkulation</td>
                    <td className="pt-1.5 text-right font-mono tabular-nums font-bold text-primary whitespace-nowrap">€ {fmt(snapVk)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-muted-foreground">
                Katalogposition ohne Komponenten-Kalkulation — Preis wurde direkt gepflegt
                (€ {fmt(snapVk)}{daten.arbeitszeit_minuten > 0 ? `, ${fmt(daten.arbeitszeit_minuten / 60)} h Arbeitszeit` : ""}).
              </p>
            )
          )}

          {daten && daten.arbeitszeit_minuten > 0 && daten.komponenten.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              ⏱️ {fmt(daten.arbeitszeit_minuten / 60)} h Arbeitszeit pro Einheit — zählt im Stundenabgleich.
            </p>
          )}

          {katalogAbweicht && (
            <p className="text-[11px] rounded bg-amber-50 border border-amber-200 text-amber-900 px-2 py-1">
              Der Katalog wurde seither geändert (aktuell € {fmt(liveVk!)}). Über „Preise aktualisieren"
              holst du den neuen Stand ins ganze Angebot.
            </p>
          )}

          {abweicht && (
            <div className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1.5">
              <span className="text-[11px] text-muted-foreground">
                Zeilenpreis € {fmt(currentEp)} weicht vom Kalkulations-Stand ab.
              </span>
              {canRestore && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => onRestore(snapVk)}>
                  <Undo2 className="w-3 h-3" /> € {fmt(snapVk)} wiederherstellen
                </Button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
