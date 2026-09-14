/**
 * Tätigkeitszeilen in Bautages-/Regieberichten.
 *
 * Statt "von–bis + Pause" werden mehrere Zeilen mit je Stunden erfasst
 * ("Aufräumen 1 h", "Stapler richten 2,5 h"); die Summe ist die Stundenzahl
 * des Berichts (Spalte `stunden`, auf die alle Auswertungen zugreifen).
 *
 * Gespeichert als JSONB-Array am Bericht — diese Datei ist die EINZIGE Stelle,
 * die das Format liest/schreibt, damit Altbestand oder Datenmüll nie
 * durchschlagen.
 */

export interface Taetigkeit {
  text: string;
  stunden: number;
}

/** Formular-Zeile: Stunden als String, damit "2,5" eingetippt werden kann. */
export interface TaetigkeitEntry {
  id: string;
  text: string;
  stunden: string;
}

/** "2,5" → 2.5 · ungültig → 0 (Repo-Muster, vgl. PositionComponentsEditor). */
export const parseStunden = (v: string | number | null | undefined): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Defensiv aus JSONB lesen — wirft nie, liefert im Zweifel []. */
export const parseTaetigkeiten = (v: unknown): Taetigkeit[] => {
  if (!Array.isArray(v)) return [];
  return v
    .map((r: any) => ({
      text: String(r?.text ?? "").trim(),
      stunden: parseStunden(r?.stunden),
    }))
    .filter(t => t.text.length > 0 || t.stunden > 0);
};

/** Summe der Zeilen, auf 2 Nachkommastellen gerundet. */
export const summeStunden = (t: Taetigkeit[]): number =>
  Math.round(t.reduce((s, x) => s + (Number(x.stunden) || 0), 0) * 100) / 100;

/** "3,50" — deutsche Schreibweise mit 2 Nachkommastellen. */
export const fmtStunden = (n: number): string =>
  (Number(n) || 0).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * "08:00 - 10:00" für Altbestand, sonst null.
 * Neue Berichte haben keine Uhrzeiten mehr — jede Anzeige muss damit umgehen.
 */
export const zeitraum = (s?: string | null, e?: string | null): string | null =>
  s && e ? `${String(s).slice(0, 5)} - ${String(e).slice(0, 5)}` : null;

/** Einzeiler für Beschreibung/Zeiteintrag: "Aufräumen (1,00 h), Stapler (2,50 h)". */
export const taetigkeitenAlsText = (t: Taetigkeit[]): string =>
  t.filter(x => x.text.trim()).map(x => `${x.text.trim()} (${fmtStunden(x.stunden)} h)`).join(", ");

/** Formular-Zeilen → Speicherformat (leere Zeilen fallen weg). */
export const entriesToTaetigkeiten = (rows: TaetigkeitEntry[]): Taetigkeit[] =>
  rows
    .map(r => ({ text: r.text.trim(), stunden: parseStunden(r.stunden) }))
    .filter(t => t.text.length > 0 && t.stunden > 0);

/** Speicherformat → Formular-Zeilen (mindestens eine leere Zeile). */
export const taetigkeitenToEntries = (t: Taetigkeit[]): TaetigkeitEntry[] => {
  const rows = t.map(x => ({
    id: crypto.randomUUID(),
    text: x.text,
    stunden: x.stunden ? String(x.stunden).replace(".", ",") : "",
  }));
  return rows.length > 0 ? rows : [{ id: crypto.randomUUID(), text: "", stunden: "" }];
};

/**
 * Regiebericht: `stunden` ist JE MITARBEITER erfasst ("1,5 h mit 2 Mann").
 * Ausgewertet und verrechnet werden Mannstunden = stunden × Anzahl.
 */
export const mannstunden = (stunden: number | string | null | undefined, anzahl: number | null | undefined): number =>
  Math.round(parseStunden(stunden) * Math.max(1, Number(anzahl) || 1) * 100) / 100;

/** "1,50 h × 2 Mitarbeiter = 3,00 Std." — bei einer Person nur "1,50 h". */
export const mannstundenText = (stunden: number | string | null | undefined, anzahl: number | null | undefined): string => {
  const n = Math.max(1, Number(anzahl) || 1);
  return n > 1
    ? `${fmtStunden(parseStunden(stunden))} h × ${n} Mitarbeiter = ${fmtStunden(mannstunden(stunden, n))} Std.`
    : `${fmtStunden(parseStunden(stunden))} h`;
};
