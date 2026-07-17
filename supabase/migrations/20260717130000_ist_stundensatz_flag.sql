-- Arbeitszeit/Stundensatz als ECHTES Merkmal am Katalog-Artikel statt
-- Namens-Heuristik: beim Anlegen eines Materials wählbar, in Listen
-- gekennzeichnet, Grundlage für den Stundensätze-Tab.
alter table public.invoice_templates
  add column if not exists ist_stundensatz boolean not null default false;

comment on column public.invoice_templates.ist_stundensatz is
  'Arbeitszeit-/Stundensatz-Artikel (Facharbeiterstunde, Regiestunde, Kranfahrer …) — erscheint im Stundensätze-Tab; Fremdleistungen mit Std-Einheit bleiben false.';

-- Backfill: die bestehenden echten Sätze über die bisherige Namensregel
-- (schließt Fremdleistungen wie „Fassadengerüst An-und Abtransport in Regie"
-- oder „Zellulose Helfer" bewusst aus).
update public.invoice_templates
   set ist_stundensatz = true
 where art = 'material'
   and coalesce(kurzbezeichnung, name) ~* '(stunden?\M|facharbeiter|lehrling|baumeister|kranfahrer|hiab)';
