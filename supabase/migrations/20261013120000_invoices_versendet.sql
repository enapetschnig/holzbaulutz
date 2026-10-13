-- Rechnungen/Angebote per E-Mail versenden (Edge Function send-invoice-email):
-- am Beleg vermerken, wann und an wen zuletzt versendet wurde.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS versendet_am timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS versendet_an text;
