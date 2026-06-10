-- E2E-Testlauf-Befunde (2026-06-10):
--
-- 1) Projekt anlegen schlug fehl, sobald keine PLZ eingegeben wurde:
--    projects.plz war NOT NULL, der Anlegen-Dialog markiert aber nur den
--    Projektnamen als Pflichtfeld und sendet plz NULL wenn leer
--    ("null value in column plz violates not-null constraint").
--    Projekte ohne Adresse (z.B. interne Projekte) müssen möglich sein.
ALTER TABLE public.projects ALTER COLUMN plz DROP NOT NULL;

-- 2) Projektnummern wurden nie vergeben: CreateProjectDialog ruft
--    next_document_number('projekt') auf, aber der Nummernkreis 'projekt'
--    fehlte in number_ranges — der RPC-Fehler wurde still geschluckt und
--    alle Projekte bekamen projektnummer NULL. Nummernkreis anlegen
--    (Format P26001, P26002, …).
INSERT INTO public.number_ranges (typ, label, prefix, suffix, format_pattern, jahr_format, stellen, start_nummer, aktuelle_nummer)
VALUES ('projekt', 'Projekt', 'P', '', '{PREFIX}{YY}{NNN}', 'YY', 3, 1, 0)
ON CONFLICT (typ) DO NOTHING;
