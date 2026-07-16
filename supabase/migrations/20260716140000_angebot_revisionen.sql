-- Automatische Angebots-Revisionen: Wird ein gespeichertes Angebot per
-- "Preise aktualisieren" auf den aktuellen Katalogstand gezogen und
-- gespeichert, bleibt das Original unangetastet (archiviert) und die neue
-- Fassung entsteht als eigenes Angebot "AN26001-R2" mit Verweis auf den
-- Vorgänger — beide Stände bleiben dauerhaft erkennbar und abrufbar.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS vorgaenger_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.invoices.revision IS 'Angebots-Revision (1 = Original, 2 = erste Preis-Aktualisierung, …)';
COMMENT ON COLUMN public.invoices.vorgaenger_id IS 'Vorherige Revision dieses Angebots (Original bleibt archiviert erhalten)';
