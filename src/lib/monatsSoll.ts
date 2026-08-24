/**
 * Persönliches Monatssoll unter Berücksichtigung von Ein- und Austritt.
 *
 * Hintergrund: Wer mitten im Monat eintritt (z. B. 06.07.), muss nicht die
 * vollen Monatsstunden leisten — Juli 2026 hat 179 h Regelarbeitszeit, ab
 * Eintritt 06.07. sind es nur 156 h. Quelle des Datums ist die Personalakte
 * (employees.eintritt_datum / austritt_datum), Fallback profiles.eintrittsdatum.
 *
 * Bewusst NICHT verändert wird die Saldo-/ZA-Logik in hoursAccounting.ts
 * (dort zählen weiterhin nur Tage mit Buchung) — das Monatssoll hier ist eine
 * zusätzliche Auswertungsgröße für das Büro.
 */

import { getNormalWorkingHours } from "@/lib/workingHours";

const fmt = (d: Date): string => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
};

/** Datum-String defensiv auf YYYY-MM-DD kürzen; ungültig → null. */
const normDatum = (v: string | null | undefined): string | null => {
  const s = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

export interface MonatsSollErgebnis {
  /** Summe Tagessoll aller Werktage im wirksamen Zeitraum des Monats. */
  sollStunden: number;
  /** Werktage im wirksamen Zeitraum (Anzahl). */
  werktage: number;
  /** Eintritt liegt in diesem Monat → Soll beginnt erst dort. */
  eintrittImMonat: string | null;
  /** Austritt liegt in diesem Monat → Soll endet dort. */
  austrittImMonat: string | null;
}

/**
 * Monatssoll in Stunden: Σ Tagessoll (Mo–Do 8 h, Fr 7 h) über alle Tage des
 * Monats, begrenzt auf [Eintritt, Austritt] sofern gesetzt.
 */
export function monatsSoll(
  year: number,
  month: number, // 1–12
  eintritt?: string | null,
  austritt?: string | null,
): MonatsSollErgebnis {
  const von = normDatum(eintritt);
  const bis = normDatum(austritt);
  const daysInMonth = new Date(year, month, 0).getDate();
  let soll = 0;
  let werktage = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day, 12);
    const ds = fmt(d);
    if (von && ds < von) continue;
    if (bis && ds > bis) continue;
    const h = getNormalWorkingHours(d);
    if (h > 0) {
      soll += h;
      werktage += 1;
    }
  }
  const monatsanfang = fmt(new Date(year, month - 1, 1, 12));
  const monatsende = fmt(new Date(year, month - 1, daysInMonth, 12));
  return {
    sollStunden: soll,
    werktage,
    eintrittImMonat: von && von > monatsanfang && von <= monatsende ? von : null,
    austrittImMonat: bis && bis >= monatsanfang && bis < monatsende ? bis : null,
  };
}

/**
 * Werktage des Monats ohne einzige Buchung — nur im wirksamen Zeitraum
 * (ab Eintritt, bis Austritt) und nie in der Zukunft.
 */
export function fehltage(
  year: number,
  month: number,
  gebuchteTage: ReadonlySet<string>,
  eintritt?: string | null,
  austritt?: string | null,
  heute: Date = new Date(),
): string[] {
  const von = normDatum(eintritt);
  const bis = normDatum(austritt);
  const heuteStr = fmt(heute);
  const daysInMonth = new Date(year, month, 0).getDate();
  const out: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day, 12);
    const ds = fmt(d);
    if (ds >= heuteStr) break; // heute & Zukunft nicht als fehlend werten
    if (von && ds < von) continue;
    if (bis && ds > bis) continue;
    if (getNormalWorkingHours(d) === 0) continue;
    if (!gebuchteTage.has(ds)) out.push(ds);
  }
  return out;
}
