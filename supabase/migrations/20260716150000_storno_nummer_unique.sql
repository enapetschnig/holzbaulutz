-- Storno-Nummern wasserdicht machen:
-- 1. UNIQUE-Index (DB-Garantie: keine doppelte Storno-Nummer, wie bei nummer)
-- 2. Advisory-Lock in next_storno_nummer: serialisiert parallele Stornos —
--    vorher konnten zwei gleichzeitige Aufrufe dieselbe MAX+1-Nummer sehen.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_storno_nummer
  ON public.invoices (storno_nummer) WHERE storno_nummer IS NOT NULL;

CREATE OR REPLACE FUNCTION public.next_storno_nummer(p_jahr integer DEFAULT (EXTRACT(year FROM now()))::integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num INTEGER;
  max_existing INTEGER;
  result TEXT;
  jahr_text TEXT;
BEGIN
  jahr_text := p_jahr::TEXT;

  -- Serialisierung paralleler Stornos (Lock endet mit der Transaktion)
  PERFORM pg_advisory_xact_lock(hashtext('storno_nummer_' || jahr_text));

  LOOP
    SELECT COALESCE(MAX(CAST(SUBSTRING(storno_nummer FROM 'ST-' || jahr_text || '-(\d+)') AS INTEGER)), 0)
    INTO max_existing
    FROM public.invoices
    WHERE storno_nummer LIKE 'ST-' || jahr_text || '-%';

    next_num := max_existing + 1;
    result := 'ST-' || jahr_text || '-' || LPAD(next_num::TEXT, 3, '0');

    IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE storno_nummer = result) THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN result;
END;
$$;
