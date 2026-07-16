-- Mitarbeiter sehen keine Geld-/Betriebszahlen (Audit-Ergebnis):
--   1) material_entries: Einzelpreise (EK aus der Kalkulation!) waren für
--      jeden aktiven Nutzer lesbar → maskierte Ansicht, Preis nur für
--      Admin/Vorarbeiter.
--   2) app_settings: SELECT USING(true) machte ALLE Settings lesbar
--      (Lohnnebenkosten-Faktor, Bankdaten, cron_webhook_secret!) →
--      nur noch Admin; für alle nur harmlose Whitelist-Keys (einheiten).
--   3) number_ranges: Nummernkreise nur noch Admin.
--   4) projects: budget + auftragsvolumen — im Code nirgends verwendet,
--      live überall NULL, aber für alle lesbar → Spalten entfernt.
--   5) bautagesberichte: laut Chef sollen ALLE Mitarbeiter ALLE
--      Bautagesberichte sehen (bisher nur eigene + Admin) → SELECT für
--      aktive Nutzer geöffnet (Schreibrechte unverändert: nur eigene).

-- ── 1) Materialpreise maskieren ─────────────────────────────────────────────
-- RLS kann keine Spalten filtern; die Ansicht liefert einzelpreis nur für
-- Admin/Vorarbeiter (security_invoker: Basis-RLS bleibt wirksam).
create or replace view public.material_entries_ansicht
  with (security_invoker = true) as
select
  id, project_id, user_id, material, menge, notizen, created_at, updated_at,
  einheit, typ, datum, disturbance_id, lieferschein_id, source_invoice_id,
  case
    when has_role(auth.uid(), 'administrator'::app_role)
      or has_role(auth.uid(), 'vorarbeiter'::app_role)
    then einzelpreis
    else null
  end as einzelpreis
from public.material_entries;

grant select on public.material_entries_ansicht to authenticated;

-- ── 2) app_settings absichern ───────────────────────────────────────────────
drop policy if exists "Authenticated users can read settings" on public.app_settings;
-- "Admins can manage settings" (FOR ALL) existiert bereits und deckt Admin-Lesen ab.
create policy "Alle lesen harmlose Settings"
  on public.app_settings for select
  using (is_active_user(auth.uid()) and key in ('einheiten'));

-- ── 3) Nummernkreise nur Admin ──────────────────────────────────────────────
drop policy if exists "auth_read_number_ranges" on public.number_ranges;
-- "admin_all_number_ranges" (FOR ALL) bleibt und deckt Admin-Lesen ab.

-- ── 4) Ungenutzte Geld-Spalten am Projekt entfernen ─────────────────────────
alter table public.projects drop column if exists budget;
alter table public.projects drop column if exists auftragsvolumen;

-- ── 5) Bautagesberichte für alle Mitarbeiter sichtbar ───────────────────────
drop policy if exists "Users can view own bautagesberichte" on public.bautagesberichte;
drop policy if exists "Admins can view all bautagesberichte" on public.bautagesberichte;
create policy "Aktive Nutzer sehen alle Bautagesberichte"
  on public.bautagesberichte for select
  using (is_active_user(auth.uid()));
