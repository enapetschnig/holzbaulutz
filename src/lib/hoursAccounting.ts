// Zentrale Saldo-Logik für Stundenauswertung.
//
// Kernregel: Überstunden und Minusstunden werden PRO TAG gerechnet,
// nicht pro time_entry. Bei mehreren Projekten am selben Tag würde
// eine per-Entry-Berechnung Math.max(0, 6h - 8h) = 0 zweimal liefern,
// obwohl der Tag in Summe 12h und damit +2h Überstunden hat.
//
// Sonderzeiten (Urlaub / Krankenstand / Feiertag / Zeitausgleich /
// Weiterbildung): Tagessoll wird auf 0 gesetzt UND die Stunden werden
// nicht als Überstunden gewertet. Saldo neutral pro solchem Tag.

import { getNormalWorkingHours } from "@/lib/workingHours";

export type TimeEntryLite = {
  datum: string;
  stunden: number | string | null;
  taetigkeit?: string | null;
};

export type DayBalance = {
  datum: string;          // YYYY-MM-DD
  ist: number;            // gebuchte Summe (alle Einträge des Tages)
  soll: number;           // Tagessoll (8 Mo-Do / 7 Fr / 0 Sa-So, 0 bei Sonderzeit)
  saldo: number;          // ist - soll, kann negativ sein
  istSonderzeit: boolean;
};

/**
 * Tätigkeiten, die das Tagessoll als erfüllt markieren — der Tag
 * wird neutral (Saldo 0) gerechnet, egal wie viele Stunden gebucht
 * sind.
 */
export const SONDER_TAETIGKEITEN = new Set([
  "Urlaub",
  "Krankenstand",
  "Feiertag",
  "Zeitausgleich",
  "Weiterbildung",
]);

/**
 * Aggregiert beliebige time_entries nach Datum und liefert je Tag
 * Ist-, Soll- und Saldo-Stunden. Sortiert aufsteigend nach Datum.
 */
export function aggregateByDay(entries: TimeEntryLite[]): DayBalance[] {
  const grouped = new Map<string, TimeEntryLite[]>();
  for (const e of entries) {
    if (!e?.datum) continue;
    const list = grouped.get(e.datum) || [];
    list.push(e);
    grouped.set(e.datum, list);
  }
  const out: DayBalance[] = [];
  for (const [datum, dayEntries] of grouped) {
    const ist = dayEntries.reduce((s, e) => s + Number(e.stunden || 0), 0);
    const sonderStunden = dayEntries.reduce(
      (s, e) => s + (!!e.taetigkeit && SONDER_TAETIGKEITEN.has(e.taetigkeit) ? Number(e.stunden || 0) : 0),
      0,
    );
    const istSonderzeit = sonderStunden > 0;
    const tagessoll = getNormalWorkingHours(new Date(datum + "T12:00:00"));
    // Neutralisieren nur, wenn die Sonderzeit das TAGESSOLL abdeckt (Ganztag).
    // Teilzeit-Sonderzeit (z.B. mittags 4h ZA + 6h Arbeit): Sonderstunden
    // zählen als Ist mit — 6h Arbeit + 4h ZA auf einen 10h-Tag = Saldo 0,
    // 7h Arbeit + 4h ZA = +1. Ganztag verhält sich exakt wie bisher.
    const deckt = sonderStunden >= tagessoll - 0.005;
    const soll = istSonderzeit && deckt ? 0 : tagessoll;
    const saldo = istSonderzeit && deckt ? 0 : ist - soll;
    out.push({ datum, ist, soll, saldo, istSonderzeit });
  }
  return out.sort((a, b) => a.datum.localeCompare(b.datum));
}

/** Saldo-Summe über die gegebenen Einträge — Auto-Saldo aus time_entries. */
export function totalAutoSaldo(entries: TimeEntryLite[]): number {
  return aggregateByDay(entries).reduce((s, d) => s + d.saldo, 0);
}

/**
 * Formatierter Saldo mit Vorzeichen (für UI und Excel-Export).
 * +0,00 bei genau 0 — leer string nur explizit angefordert.
 */
export function formatSaldo(value: number, opts?: { hideZero?: boolean }): string {
  if (opts?.hideZero && Math.abs(value) < 0.005) return "";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "±";
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

/**
 * Gearbeitete Stunden getrennt von Sonderzeiten. „Gesamtstunden" zeigen
 * die tatsächlich gearbeiteten Stunden — Urlaub, Krankenstand, Feiertag,
 * Zeitausgleich und Weiterbildung stehen daneben, je Art aufgeschlüsselt.
 * (Meldung 21.09.2026: Weiterbildung am Samstag hatte die Gesamtstunden
 * um 8 h aufgeblasen.)
 */
export type StundenAufteilung = {
  gearbeitet: number;
  sonder: { taetigkeit: string; stunden: number }[];   // nur Arten mit > 0, in Set-Reihenfolge
  sonderGesamt: number;
  gesamtInklSonder: number;
};

export function stundenAufteilung(entries: TimeEntryLite[]): StundenAufteilung {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  let gearbeitet = 0;
  const proArt = new Map<string, number>();
  for (const e of entries) {
    const h = Number(e?.stunden || 0);
    if (e?.taetigkeit && SONDER_TAETIGKEITEN.has(e.taetigkeit)) {
      proArt.set(e.taetigkeit, (proArt.get(e.taetigkeit) || 0) + h);
    } else {
      gearbeitet += h;
    }
  }
  const sonder = [...SONDER_TAETIGKEITEN]
    .filter(t => (proArt.get(t) || 0) > 0)
    .map(t => ({ taetigkeit: t, stunden: r2(proArt.get(t)!) }));
  const sonderGesamt = r2(sonder.reduce((a, b) => a + b.stunden, 0));
  return { gearbeitet: r2(gearbeitet), sonder, sonderGesamt, gesamtInklSonder: r2(gearbeitet + sonderGesamt) };
}

/** "Urlaub 16,00 h · Weiterbildung 12,50 h" — leer, wenn keine Sonderzeit. */
export function sonderzeitenText(a: StundenAufteilung): string {
  return a.sonder.map(x => `${x.taetigkeit} ${x.stunden.toFixed(2)} h`).join(" · ");
}
