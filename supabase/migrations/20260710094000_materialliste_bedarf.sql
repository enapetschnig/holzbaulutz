-- ============================================================================
-- Projekt-Materialliste: Soll-Bedarf aus dem Angebot
-- ----------------------------------------------------------------------------
-- Nach Angebots-Erstellung wird pro Projekt eine Materialliste erzeugt:
-- die Komponenten der Angebots-Positionen (Materialien) landen als
-- typ='bedarf'-Zeilen in material_entries. source_invoice_id macht die
-- Generierung idempotent (alte Bedarf-Zeilen des Angebots werden ersetzt)
-- und räumt beim Löschen des Angebots automatisch auf (ON DELETE CASCADE).
-- ============================================================================

ALTER TABLE public.material_entries
  ADD COLUMN IF NOT EXISTS source_invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_material_entries_source_invoice
  ON public.material_entries(source_invoice_id);
