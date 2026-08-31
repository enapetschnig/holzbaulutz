-- Eventualposition (EV): Position, die nur bei Bedarf beauftragt wird.
-- Am Beleg steht nur der Einheitspreis — kein Positionspreis, und die Zeile
-- zählt in keiner Summe mit (der Client hält gesamtpreis bei EV auf 0).
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS eventual BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.invoice_items.eventual IS
  'Eventualposition: nur Einheitspreis am Beleg, gesamtpreis bleibt 0, zählt nicht in Endsumme/Leistungsstand/Stundenabgleich';

NOTIFY pgrst, 'reload schema';
