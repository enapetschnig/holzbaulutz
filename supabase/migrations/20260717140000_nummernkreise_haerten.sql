-- Nummernkreis-Härtung (Audit-Befunde):
--   1) Endlosschleifen-Schutz: ein Format ohne {NNN}/{N} ließ den Skip-Loop
--      ewig dieselbe Nummer erzeugen (Statement-Timeout + gesperrter Kreis).
--   2) Eindeutigkeits-Check je Typ gegen die RICHTIGE Tabelle:
--      kundennummer → customers, projekt → projects, sonst invoices.
--   3) Jahreswechsel: bei {YY}/{YYYY}-Formaten beginnt der Zähler im neuen
--      Jahr wieder bei der Startnummer (neue Spalte number_ranges.jahr).
--      Der Skip-Loop schützt weiterhin vor Kollisionen mit Alt-Nummern.
alter table public.number_ranges
  add column if not exists jahr integer;

create or replace function public.next_document_number(p_typ text, p_jahr integer default null::integer)
 returns text
 language plpgsql
 security definer
as $function$
DECLARE
  nr RECORD;
  effective_typ TEXT;
  next_num INTEGER;
  year_str TEXT;
  result TEXT;
  actual_year INTEGER;
  guard INTEGER := 0;
  taken BOOLEAN;
BEGIN
  actual_year := COALESCE(p_jahr, EXTRACT(YEAR FROM NOW())::INTEGER);

  -- Rechnungsähnliche Typen teilen sich den "rechnung"-Nummernkreis
  IF p_typ IN ('anzahlungsrechnung', 'schlussrechnung') THEN
    effective_typ := 'rechnung';
  ELSE
    effective_typ := p_typ;
  END IF;

  -- Row-Lock: serialisiert parallele Aufrufe pro Nummernkreis
  SELECT * INTO nr FROM public.number_ranges
   WHERE typ = effective_typ
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown document type: %', effective_typ;
  END IF;

  -- Schutz vor kaputtem Format: ohne Laufnummern-Platzhalter würde der
  -- Skip-Loop nie terminieren.
  IF position('{NNN}' in nr.format_pattern) = 0 AND position('{N}' in nr.format_pattern) = 0 THEN
    RAISE EXCEPTION 'Nummernkreis %: format_pattern muss {NNN} oder {N} enthalten (aktuell: %)', effective_typ, nr.format_pattern;
  END IF;

  IF nr.jahr_format = 'YYYY' THEN
    year_str := actual_year::TEXT;
  ELSE
    year_str := LPAD((actual_year % 100)::TEXT, 2, '0');
  END IF;

  -- Jahreswechsel: Jahres-Formate beginnen im neuen Jahr wieder bei der
  -- Startnummer. Kreise ohne Jahres-Platzhalter laufen einfach weiter.
  IF (position('{YY}' in nr.format_pattern) > 0 OR position('{YYYY}' in nr.format_pattern) > 0)
     AND nr.jahr IS DISTINCT FROM actual_year THEN
    IF nr.jahr IS NOT NULL AND actual_year > nr.jahr THEN
      nr.aktuelle_nummer := 0;
      UPDATE public.number_ranges SET aktuelle_nummer = 0 WHERE typ = effective_typ;
    END IF;
    UPDATE public.number_ranges SET jahr = actual_year WHERE typ = effective_typ;
  END IF;

  next_num := GREATEST(nr.aktuelle_nummer + 1, nr.start_nummer);

  -- Eindeutigkeit garantieren: existierende Nummern überspringen —
  -- je Typ gegen die Tabelle, in der die Nummer tatsächlich lebt.
  LOOP
    result := nr.format_pattern;
    result := REPLACE(result, '{PREFIX}', COALESCE(nr.prefix, ''));
    result := REPLACE(result, '{SUFFIX}', COALESCE(nr.suffix, ''));
    result := REPLACE(result, '{YY}', year_str);
    result := REPLACE(result, '{YYYY}', actual_year::TEXT);
    result := REPLACE(result, '{NNN}', LPAD(next_num::TEXT, nr.stellen, '0'));
    result := REPLACE(result, '{N}', next_num::TEXT);

    IF effective_typ = 'kundennummer' THEN
      taken := EXISTS (SELECT 1 FROM public.customers WHERE kundennummer = result);
    ELSIF effective_typ = 'projekt' THEN
      taken := EXISTS (SELECT 1 FROM public.projects WHERE projektnummer = result);
    ELSE
      taken := EXISTS (SELECT 1 FROM public.invoices WHERE nummer = result);
    END IF;
    EXIT WHEN NOT taken;

    next_num := next_num + 1;
    guard := guard + 1;
    IF guard > 100000 THEN
      RAISE EXCEPTION 'Nummernkreis %: keine freie Nummer gefunden (Format/Daten prüfen)', effective_typ;
    END IF;
  END LOOP;

  UPDATE public.number_ranges
     SET aktuelle_nummer = next_num,
         updated_at = NOW()
   WHERE typ = effective_typ;

  RETURN result;
END;
$function$;
