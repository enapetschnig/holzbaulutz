/**
 * Rechnungs-Entwurf: Eine Rechnung (auch Anzahlungs-/Schlussrechnung) kann
 * zwischengespeichert und später weiterbearbeitet werden, ohne sie
 * auszustellen. Die fortlaufende Belegnummer wird erst beim Ausstellen
 * vergeben — bis dahin trägt der Datensatz einen Platzhalter (nummer ist in
 * der DB NOT NULL UNIQUE), der nirgends als echte Nummer erscheinen darf.
 */
export const ENTWURF_PREFIX = "ENTWURF-";

export const istEntwurfsNummer = (nummer?: string | null): boolean =>
  !!nummer && nummer.startsWith(ENTWURF_PREFIX);

export const neueEntwurfsNummer = (): string =>
  `${ENTWURF_PREFIX}${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

/** Für Anzeige/Druck: Platzhalter → "Entwurf", sonst die Nummer selbst. */
export const anzeigeNummer = (nummer?: string | null): string =>
  istEntwurfsNummer(nummer) ? "Entwurf" : (nummer || "");
