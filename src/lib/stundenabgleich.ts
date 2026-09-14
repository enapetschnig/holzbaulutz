import { supabase } from "@/integrations/supabase/client";
import { istArbeitszeitZeile } from "@/lib/stunden";

/**
 * Stundenabgleich „Angebot vs. gebucht" — EINE Rechenlogik für Startseite
 * (StundenabgleichWidget) und Projektübersicht (ProjectOverview).
 *
 * Drei Regeln (Änderungswünsche vom 11.09.2026):
 *
 *  1. Soll = alle ANGENOMMENEN Angebote des Projekts zusammen (Nachtrag als
 *     zweites Angebot erhöht das Soll automatisch). Gibt es keines, zählt das
 *     beste andere: offen vor Entwurf, jeweils das neueste. Abgelehnte,
 *     stornierte und archivierte Revisionen nie.
 *
 *  2. Regieberichte zählen nur dann gegen das Angebot, wenn das Angebot
 *     Regiestunden enthält. Sonst laufen sie daneben als Zusatzleistung, die
 *     separat verrechnet wird — und verfälschen den Vergleich nicht.
 *
 *  3. Mitarbeiter buchen auf Projekte, nicht auf Angebote — die Zuordnung
 *     löst diese Bibliothek, nicht der Monteur am Handy.
 */

export interface AbgleichPosition {
  position: number;
  beschreibung: string;
  menge: number;
  einheit: string;
  stunden: number;
  /** „stunden" = explizite Stunden-Position, „kalkulation" = aus der
   *  Kalkulation der Position, „regie" = Regiestunden-Position */
  quelle: "stunden" | "kalkulation" | "regie";
  angebotNummer: string;
}

export interface Stundenabgleich {
  /** Soll laut Angebot ohne Regie-Positionen */
  angebotNormal: number;
  /** Regiestunden laut Angebot (0 = keine drin) */
  angebotRegie: number;
  /** gebuchte Stunden aus der Zeiterfassung (ohne Regieberichte) */
  gebuchtNormal: number;
  /** gebuchte Mannstunden aus Regieberichten */
  gebuchtRegie: number;
  /** Regel 2: enthält das Angebot Regiestunden? */
  regieImAngebot: boolean;
  /** Die verglichenen Werte nach Regel 2 */
  soll: number;
  ist: number;
  /** Regiestunden, die NICHT gegen das Angebot zählen (Regel 2, Fall „kommt dazu") */
  regieZusatz: number;
  positionen: AbgleichPosition[];
  angebotNummern: string[];
}

/** Regiestunden-Position im Angebot („Regiestunde Facharbeiter × 70 Std.") */
export const istRegiePosition = (name: string | null | undefined, einheit: string | null | undefined) =>
  istArbeitszeitZeile(name, einheit) && /regie/i.test(String(name || ""));

type ItemLite = {
  invoice_id?: string; position?: number; beschreibung?: string | null; kurztext?: string | null;
  menge: number | string | null; einheit?: string | null; arbeitszeit_minuten?: number | string | null; eventual?: boolean | null;
};
type EntryLite = { stunden: number | string | null; disturbance_id?: string | null };

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Reine Rechenlogik — ohne Datenbank, damit sie testbar bleibt. */
export function berechneStundenabgleich(
  items: ItemLite[],
  entries: EntryLite[],
  nummerVonInvoice: Record<string, string> = {},
): Stundenabgleich {
  const positionen: AbgleichPosition[] = [];
  let angebotNormal = 0, angebotRegie = 0;
  for (const it of items) {
    if (it.eventual) continue;                       // nicht beauftragt → kein Soll
    const name = it.kurztext || it.beschreibung || "";
    const menge = Number(it.menge) || 0;
    const stdZeile = istArbeitszeitZeile(name, it.einheit);
    const stunden = stdZeile
      ? menge
      : ((Number(it.arbeitszeit_minuten) || 0) * menge) / 60;
    if (!(stunden > 0)) continue;
    const quelle: AbgleichPosition["quelle"] = istRegiePosition(name, it.einheit) ? "regie" : stdZeile ? "stunden" : "kalkulation";
    if (quelle === "regie") angebotRegie += stunden; else angebotNormal += stunden;
    positionen.push({
      position: Number(it.position) || positionen.length + 1,
      beschreibung: name, menge, einheit: it.einheit || "Stk.",
      stunden: r1(stunden), quelle,
      angebotNummer: (it.invoice_id && nummerVonInvoice[it.invoice_id]) || "",
    });
  }

  let gebuchtNormal = 0, gebuchtRegie = 0;
  for (const e of entries) {
    const h = Number(e.stunden) || 0;
    if (e.disturbance_id) gebuchtRegie += h; else gebuchtNormal += h;
  }

  const regieImAngebot = angebotRegie > 0;
  const soll = regieImAngebot ? angebotNormal + angebotRegie : angebotNormal;
  const ist = regieImAngebot ? gebuchtNormal + gebuchtRegie : gebuchtNormal;
  return {
    angebotNormal: r1(angebotNormal), angebotRegie: r1(angebotRegie),
    gebuchtNormal: r1(gebuchtNormal), gebuchtRegie: r1(gebuchtRegie),
    regieImAngebot, soll: r1(soll), ist: r1(ist),
    regieZusatz: regieImAngebot ? 0 : r1(gebuchtRegie),
    positionen,
    angebotNummern: [...new Set(positionen.map(p => p.angebotNummer).filter(Boolean))],
  };
}

/**
 * Welche Angebote eines Projekts bilden das Soll? Regel 1.
 * Erwartet die nicht-archivierten, nicht abgelehnten/stornierten Angebote.
 */
export function waehleAngebote<T extends { id: string; status: string | null; datum: string | null }>(angebote: T[]): T[] {
  const angenommen = angebote.filter(a => a.status === "angenommen" || a.status === "verrechnet");
  if (angenommen.length > 0) return angenommen;
  const rang: Record<string, number> = { offen: 0, entwurf: 1 };
  const sortiert = angebote.slice().sort((a, b) => {
    const d = (rang[a.status || ""] ?? 2) - (rang[b.status || ""] ?? 2);
    return d !== 0 ? d : String(b.datum || "").localeCompare(String(a.datum || ""));
  });
  return sortiert.length ? [sortiert[0]] : [];
}

/** Lädt und berechnet den Abgleich für mehrere Projekte auf einmal. */
export async function ladeStundenabgleich(projectIds: string[]): Promise<Record<string, Stundenabgleich>> {
  const out: Record<string, Stundenabgleich> = {};
  if (projectIds.length === 0) return out;

  const [{ data: angebote }, { data: entries }] = await Promise.all([
    supabase.from("invoices")
      .select("id, project_id, nummer, status, datum")
      .in("project_id", projectIds)
      .eq("typ", "angebot")
      .not("status", "in", '("storniert","abgelehnt")')
      .or("archiviert.is.null,archiviert.eq.false"),
    supabase.from("time_entries")
      .select("project_id, stunden, disturbance_id")
      .in("project_id", projectIds),
  ]);

  const angeboteByProject: Record<string, any[]> = {};
  for (const a of ((angebote as any[]) || [])) {
    if (!a.project_id) continue;
    (angeboteByProject[a.project_id] = angeboteByProject[a.project_id] || []).push(a);
  }
  const gewaehlt: Record<string, any[]> = {};
  const nummerVonInvoice: Record<string, string> = {};
  const alleIds: string[] = [];
  for (const pid of projectIds) {
    gewaehlt[pid] = waehleAngebote(angeboteByProject[pid] || []);
    for (const a of gewaehlt[pid]) { alleIds.push(a.id); nummerVonInvoice[a.id] = a.nummer || ""; }
  }

  let items: any[] = [];
  if (alleIds.length > 0) {
    const { data } = await supabase.from("invoice_items")
      .select("invoice_id, position, beschreibung, kurztext, menge, einheit, arbeitszeit_minuten, eventual")
      .in("invoice_id", alleIds)
      .order("position");
    items = (data as any[]) || [];
  }

  for (const pid of projectIds) {
    const ids = new Set(gewaehlt[pid].map(a => a.id));
    out[pid] = berechneStundenabgleich(
      items.filter(i => ids.has(i.invoice_id)),
      ((entries as any[]) || []).filter(e => e.project_id === pid),
      nummerVonInvoice,
    );
  }
  return out;
}
