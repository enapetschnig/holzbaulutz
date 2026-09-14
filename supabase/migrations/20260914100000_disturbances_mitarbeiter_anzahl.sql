-- Regiebericht: Stunden sind JE MITARBEITER erfasst ("1,5 h mit 2 Mann").
-- Ausgewertet und verrechnet werden Mannstunden = stunden × mitarbeiter_anzahl.
-- Die Anzahl wird beim Speichern gesetzt (Ersteller + ausgewählte Mitarbeiter)
-- und hier für den Bestand aus disturbance_workers nachgerechnet.
ALTER TABLE public.disturbances
  ADD COLUMN IF NOT EXISTS mitarbeiter_anzahl INTEGER NOT NULL DEFAULT 1
  CHECK (mitarbeiter_anzahl >= 1);

COMMENT ON COLUMN public.disturbances.mitarbeiter_anzahl IS
  'Anzahl beteiligter Mitarbeiter (inkl. Ersteller). Mannstunden = stunden × mitarbeiter_anzahl';

UPDATE public.disturbances d
   SET mitarbeiter_anzahl = GREATEST(1, w.n)
  FROM (SELECT disturbance_id, COUNT(DISTINCT user_id) AS n
          FROM public.disturbance_workers GROUP BY disturbance_id) w
 WHERE w.disturbance_id = d.id;

NOTIFY pgrst, 'reload schema';
