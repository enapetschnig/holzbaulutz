-- Belegzeilen dürfen negative Einzelpreise haben (Nachlass, Abzug einer
-- außerhalb der App gestellten Teilrechnung, Gutschrift-Zeile …) —
-- Wunsch Holzbau Lutz 23.10.2026: „kann kein Minus vor die Position eingeben".
-- Der Beleg als Ganzes muss weiterhin > 0 sein (prüft die App beim Speichern).
-- Der Katalog (invoice_templates_preis_nonneg) bleibt unverändert >= 0.
ALTER TABLE public.invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_preis_nonneg;
