-- Katalog-VK-Snapshot je Rechnungs-/Angebotszeile.
-- Der Stale-Check ("Preise im Katalog geändert") verglich bisher den
-- AKTUELLEN Zeilenpreis mit dem Katalog — dadurch galt jeder bewusst
-- verhandelte Preis als "Katalog-Änderung" und "Preise aktualisieren"
-- überschrieb ihn kommentarlos. Mit dem Snapshot gilt eine Zeile nur noch
-- als stale, wenn sich der KATALOG seit dem Einfügen geändert hat.
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS katalog_vk numeric;
COMMENT ON COLUMN public.invoice_items.katalog_vk IS
  'Katalog-VK zum Zeitpunkt des Einfügens/letzten Preis-Updates (Stale-Referenz)';
