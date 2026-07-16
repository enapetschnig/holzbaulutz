-- RLS-Härtung nach Rollen-Audit:
--   1) Kalkulations-Katalog (EK-Preise, Margen, Komponenten) nur noch für
--      Administratoren lesbar/schreibbar — vorher konnte JEDER aktive Nutzer
--      EK-Preise lesen und Komponenten sogar schreiben.
--   2) Storage-Bucket "purchase-invoices" (Eingangsrechnungs-PDFs) nur noch
--      Admin + Vorarbeiter — vorher alle authentifizierten Nutzer inkl.
--      Lesen/Löschen fremder Belege.
--   3) invoices-INSERT nur noch Administratoren (Angebote/Rechnungen werden
--      ausschließlich in Admin-Flows erstellt).
--   4) Mitarbeiter-Zugriff auf Eingangsrechnungen entfernt (Tabelle +
--      Feature-Matrix) — Mitarbeiter sollen nur Zeiterfassung, Regieberichte
--      und Bautagesberichte nutzen. Über die Rechte-Matrix im Admin-Bereich
--      bleibt das jederzeit wieder aktivierbar (dann auch Storage-Policy
--      anpassen).

-- ── 1) Kalkulations-Katalog ────────────────────────────────────────────────

-- invoice_templates: offene SELECT-Policy entfernen; Admin behält Zugriff
-- über die bestehende "Admins can manage invoice templates" (FOR ALL).
drop policy if exists "Authenticated users can view invoice templates" on public.invoice_templates;

-- position_components: bisher FOR ALL für jeden aktiven Nutzer → nur Admin.
drop policy if exists "Active users can manage position components" on public.position_components;
drop policy if exists "Active users can view position components" on public.position_components;
create policy "Admins can manage position components"
  on public.position_components
  for all
  using (has_role(auth.uid(), 'administrator'::app_role) and is_active_user(auth.uid()))
  with check (has_role(auth.uid(), 'administrator'::app_role) and is_active_user(auth.uid()));

-- invoice_template_components: offene SELECT-Policy (USING true) entfernen;
-- "Template components owner manage" (Owner/Admin, FOR ALL) bleibt bestehen.
drop policy if exists "Template components read all" on public.invoice_template_components;

-- ── 2) Storage: Eingangsrechnungs-Belege ───────────────────────────────────

drop policy if exists "Auth users can read purchase-invoices" on storage.objects;
drop policy if exists "Auth users can upload purchase-invoices" on storage.objects;
drop policy if exists "Auth users can delete purchase-invoices" on storage.objects;

create policy "Eingangsrechnungen lesen (Admin/Vorarbeiter)"
  on storage.objects for select
  using (
    bucket_id = 'purchase-invoices'
    and (has_role(auth.uid(), 'administrator'::app_role) or has_role(auth.uid(), 'vorarbeiter'::app_role))
  );

create policy "Eingangsrechnungen hochladen (Admin/Vorarbeiter)"
  on storage.objects for insert
  with check (
    bucket_id = 'purchase-invoices'
    and (has_role(auth.uid(), 'administrator'::app_role) or has_role(auth.uid(), 'vorarbeiter'::app_role))
  );

-- upsert:true beim Upload braucht auch UPDATE auf ein bestehendes Objekt
create policy "Eingangsrechnungen ersetzen (Admin/Vorarbeiter)"
  on storage.objects for update
  using (
    bucket_id = 'purchase-invoices'
    and (has_role(auth.uid(), 'administrator'::app_role) or has_role(auth.uid(), 'vorarbeiter'::app_role))
  )
  with check (
    bucket_id = 'purchase-invoices'
    and (has_role(auth.uid(), 'administrator'::app_role) or has_role(auth.uid(), 'vorarbeiter'::app_role))
  );

create policy "Eingangsrechnungen loeschen (Admin/Vorarbeiter)"
  on storage.objects for delete
  using (
    bucket_id = 'purchase-invoices'
    and (has_role(auth.uid(), 'administrator'::app_role) or has_role(auth.uid(), 'vorarbeiter'::app_role))
  );

-- ── 3) invoices: INSERT nur noch Admin ─────────────────────────────────────

drop policy if exists "Users can insert own invoices" on public.invoices;
create policy "Admins can insert own invoices"
  on public.invoices for insert
  with check (
    auth.uid() = user_id
    and has_role(auth.uid(), 'administrator'::app_role)
    and is_active_user(auth.uid())
  );

-- ── 4) Eingangsrechnungen: Mitarbeiter-Zugriff entfernen ───────────────────

drop policy if exists "Mitarbeiter can insert purchase_invoices" on public.purchase_invoices;
drop policy if exists "Mitarbeiter can manage own purchase_invoices" on public.purchase_invoices;
drop policy if exists "Mitarbeiter can view own purchase_invoices" on public.purchase_invoices;

update public.role_permissions
   set can_view = false, can_edit = false, updated_at = now()
 where role = 'mitarbeiter' and feature = 'eingangsrechnungen';
