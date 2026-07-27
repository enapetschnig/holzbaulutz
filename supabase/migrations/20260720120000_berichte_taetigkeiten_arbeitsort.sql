-- Bautages-/Regiebericht: Tätigkeitszeilen statt "von-bis"
--   * taetigkeiten: [{"text":"Aufräumen","stunden":1}, …] — Summe = stunden
--   * location_type (nur Bautagesbericht): baustelle | werkstatt
--   * Uhrzeiten werden optional (Altbestand + alte PDFs bleiben lesbar)
--   * time_entries: gespiegelte Berichtsstunden dürfen ohne Uhrzeit gebucht
--     werden — erfundene Zeiten würden Überschneidungswarnungen auslösen und
--     bei zwei Berichten am selben Tag in die Unique-Verletzung laufen.

alter table public.bautagesberichte
  add column if not exists taetigkeiten  jsonb not null default '[]'::jsonb,
  add column if not exists location_type text  not null default 'baustelle',
  alter column start_time drop not null,
  alter column end_time   drop not null;

alter table public.disturbances
  add column if not exists taetigkeiten jsonb not null default '[]'::jsonb,
  alter column start_time drop not null,
  alter column end_time   drop not null;

-- check_time_order (end_time > start_time) ist bei NULL erfüllt (CHECK schlägt
-- nur bei FALSE fehl); idx_time_entries_unique_block greift laut seiner
-- WHERE-Klausel ohnehin nur bei gesetzter start_time. Beide bleiben gültig.
alter table public.time_entries
  alter column start_time drop not null,
  alter column end_time   drop not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'btb_location_type_valid') then
    alter table public.bautagesberichte add constraint btb_location_type_valid
      check (location_type in ('baustelle','werkstatt'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'btb_taetigkeiten_array') then
    alter table public.bautagesberichte add constraint btb_taetigkeiten_array
      check (jsonb_typeof(taetigkeiten) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dist_taetigkeiten_array') then
    alter table public.disturbances add constraint dist_taetigkeiten_array
      check (jsonb_typeof(taetigkeiten) = 'array');
  end if;
end $$;

comment on column public.bautagesberichte.taetigkeiten is
  'Tätigkeitszeilen [{"text","stunden"}] — Summe entspricht der Spalte stunden';
comment on column public.bautagesberichte.location_type is
  'Arbeitsort, wird 1:1 nach time_entries.location_type gespiegelt (baustelle|werkstatt)';
comment on column public.disturbances.taetigkeiten is
  'Tätigkeitszeilen [{"text","stunden"}] — Summe entspricht der Spalte stunden';

-- Altbestand ins neue Format spiegeln, damit alte Berichte editierbar bleiben
update public.bautagesberichte
   set taetigkeiten = jsonb_build_array(
         jsonb_build_object('text', left(coalesce(nullif(btrim(beschreibung), ''), 'Arbeitszeit'), 150),
                            'stunden', stunden))
 where taetigkeiten = '[]'::jsonb and stunden > 0;

update public.disturbances
   set taetigkeiten = jsonb_build_array(
         jsonb_build_object('text', left(coalesce(nullif(btrim(beschreibung), ''), 'Arbeitszeit'), 150),
                            'stunden', stunden))
 where taetigkeiten = '[]'::jsonb and stunden > 0;
