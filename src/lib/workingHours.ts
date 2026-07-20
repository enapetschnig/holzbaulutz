export interface WorkTimePreset {
  startTime: string;
  endTime: string;
  pauseStart: string;
  pauseEnd: string;
  pauseMinutes: number;
  totalHours: number;
}

/**
 * Regelarbeitszeit Holzbau Lutz:
 *   Mo–Do: 07:30–12:00 und 13:00–16:30 (Pause 12–13) = 8 h
 *   Fr:    07:30–12:00 und 13:00–15:30 (Pause 12–13) = 7 h
 *   Sa/So: arbeitsfrei
 *   Wochensoll: 4×8 + 7 = 39 h
 */
export function getNormalWorkingHours(date: Date): number {
  const dayOfWeek = date.getDay();
  if (dayOfWeek >= 1 && dayOfWeek <= 4) return 8;
  if (dayOfWeek === 5) return 7;
  return 0;
}

/**
 * Früher gab es einen Freitags-Überstundenanteil — entfällt mit der
 * aktuellen Regelung. Funktion bleibt für Kompatibilität.
 */
export function getFridayOvertime(_date: Date): number {
  return 0;
}

/**
 * Gesamte Arbeitsstunden inkl. optionaler Überstunden pro Tag.
 * Deckungsgleich mit getNormalWorkingHours, da es keine automatischen
 * Überstundenanteile mehr gibt.
 */
export function getTotalWorkingHours(date: Date): number {
  return getNormalWorkingHours(date);
}

/**
 * Wochensoll: 4 × 8h (Mo–Do) + 7h (Fr) = 39 Stunden.
 */
export function getWeeklyTargetHours(): number {
  return 39;
}

/**
 * Standard-Arbeitszeiten für einen Tag (Regelarbeitszeit).
 */
export function getDefaultWorkTimes(date: Date): WorkTimePreset | null {
  const dayOfWeek = date.getDay();

  // Mo-Do: 07:30 - 16:30, Pause 12:00 - 13:00 = 8h netto
  if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    return {
      startTime: "07:30",
      endTime: "16:30",
      pauseStart: "12:00",
      pauseEnd: "13:00",
      pauseMinutes: 60,
      totalHours: 8,
    };
  }

  // Fr: 07:30 - 15:30, Pause 12:00 - 13:00 = 7h netto
  if (dayOfWeek === 5) {
    return {
      startTime: "07:30",
      endTime: "15:30",
      pauseStart: "12:00",
      pauseEnd: "13:00",
      pauseMinutes: 60,
      totalHours: 7,
    };
  }

  // Sa/So: arbeitsfrei
  return null;
}

/**
 * Arbeitsfrei: Samstag und Sonntag.
 */
export function isNonWorkingDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}
