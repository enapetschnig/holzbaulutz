-- Zahlen-Schutz Teil 2 (weitere Audit-Funde):
--   1) invoice_payments: FOR ALL USING(true) — jeder konnte alle Zahlungs-
--      eingänge lesen UND schreiben → nur noch Admin.
--   2) mahnung_history: FOR ALL USING(true) → nur noch Admin.
--   3) disturbance_materials: einzelpreis fremder Regieberichte war für alle
--      lesbar → Zugriff folgt jetzt dem Eltern-Regiebericht (eigener Bericht
--      oder Admin).
--   4) material_entries: SELECT auf der Basistabelle nur noch Admin/
--      Vorarbeiter — Mitarbeiter lesen über die maskierte Ansicht
--      material_entries_ansicht (ohne einzelpreis). Die Ansicht wird dafür
--      von security_invoker auf Owner-Rechte umgestellt und filtert selbst
--      auf aktive Nutzer; Schreibrechte (eigene Einträge) bleiben unberührt.

-- ── 1) Zahlungseingänge nur Admin ───────────────────────────────────────────
drop policy if exists "Authenticated users can manage payments" on public.invoice_payments;
create policy "Admins verwalten Zahlungen"
  on public.invoice_payments for all
  using (has_role(auth.uid(), 'administrator'::app_role) and is_active_user(auth.uid()))
  with check (has_role(auth.uid(), 'administrator'::app_role) and is_active_user(auth.uid()));

-- ── 2) Mahnhistorie nur Admin ───────────────────────────────────────────────
drop policy if exists "Authenticated users can manage mahnung_history" on public.mahnung_history;
create policy "Admins verwalten Mahnhistorie"
  on public.mahnung_history for all
  using (has_role(auth.uid(), 'administrator'::app_role) and is_active_user(auth.uid()))
  with check (has_role(auth.uid(), 'administrator'::app_role) and is_active_user(auth.uid()));

-- ── 3) Regiebericht-Materialien folgen dem Bericht ──────────────────────────
drop policy if exists "Authenticated users can view disturbance materials" on public.disturbance_materials;
create policy "Materialien des eigenen Berichts oder Admin"
  on public.disturbance_materials for select
  using (
    is_active_user(auth.uid())
    and exists (
      select 1 from public.disturbances d
      where d.id = disturbance_materials.disturbance_id
        and (d.user_id = auth.uid() or has_role(auth.uid(), 'administrator'::app_role))
    )
  );

-- ── 4) material_entries: Basistabelle dicht, Ansicht als Lesepfad ───────────
drop policy if exists "Authenticated users can view material entries" on public.material_entries;
create policy "Admin und Vorarbeiter lesen material_entries"
  on public.material_entries for select
  using (
    is_active_user(auth.uid())
    and (has_role(auth.uid(), 'administrator'::app_role) or has_role(auth.uid(), 'vorarbeiter'::app_role))
  );

-- Ansicht neu: Owner-Rechte (liest an der Basis-RLS vorbei), eigener
-- Aktiv-Filter, einzelpreis nur für Admin/Vorarbeiter. Für Mitarbeiter ist
-- damit auch per API kein Preis mehr erreichbar.
drop view if exists public.material_entries_ansicht;
create view public.material_entries_ansicht as
select
  id, project_id, user_id, material, menge, notizen, created_at, updated_at,
  einheit, typ, datum, disturbance_id, lieferschein_id, source_invoice_id,
  case
    when has_role(auth.uid(), 'administrator'::app_role)
      or has_role(auth.uid(), 'vorarbeiter'::app_role)
    then einzelpreis
    else null
  end as einzelpreis
from public.material_entries
where is_active_user(auth.uid());

grant select on public.material_entries_ansicht to authenticated;
