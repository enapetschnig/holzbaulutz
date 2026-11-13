/**
 * Zeitraster der Zeiterfassung: Uhrzeiten und Pausen im Viertelstunden-Takt
 * (Wunsch aus dem Büro 13.11.2026: „Stunden und Mittagspause in
 * Viertelstunden-Takt eintragen“). Zentral, damit Zeiterfassung,
 * „Meine Stunden“ und Abwesenheit dieselben Schritte anbieten.
 */

/** Alle Uhrzeiten 00:00 … 23:45 in 15-Minuten-Schritten. */
export const VIERTELSTUNDEN: string[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

/** Pausen-Knöpfe (Minuten) im Viertelstunden-Takt. */
export const PAUSE_OPTIONEN: { label: string; value: number }[] = [
  { label: "Keine", value: 0 },
  { label: "15 Min", value: 15 },
  { label: "30 Min", value: 30 },
  { label: "45 Min", value: 45 },
  { label: "1 Std", value: 60 },
  { label: "1¼ Std", value: 75 },
  { label: "1½ Std", value: 90 },
  { label: "2 Std", value: 120 },
];

/**
 * Liste für ein Uhrzeit-Auswahlfeld: Viertelstunden plus – falls ein
 * bestehender Eintrag eine krumme Uhrzeit hat (z. B. vom Büro frei
 * eingetippt) – genau diese, damit das Feld nicht leer wirkt.
 */
export const uhrzeitAuswahl = (aktuell?: string | null): string[] => {
  const t = (aktuell || "").slice(0, 5);
  if (!t || VIERTELSTUNDEN.includes(t)) return VIERTELSTUNDEN;
  return [...VIERTELSTUNDEN, t].sort();
};
