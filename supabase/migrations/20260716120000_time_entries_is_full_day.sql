-- Teilzeit-Abwesenheiten (z.B. mittags auf Zeitausgleich): Unterscheidung
-- Ganztages- vs. Teilzeit-Sonderzeit. Ganztages-Sonderzeit blockiert weitere
-- Buchungen am Tag; Teilzeit-Sonderzeit läuft über den normalen
-- Überlappungs-Check und koexistiert mit Arbeitszeit.
-- NULL = Altbestand, wird konservativ als Ganztag behandelt.
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS is_full_day boolean;
COMMENT ON COLUMN public.time_entries.is_full_day IS
  'Sonderzeit: true=ganztägig (blockiert den Tag), false=Teilzeit (Von/Bis). NULL=Altbestand (wie ganztägig).';
