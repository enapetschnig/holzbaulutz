---
paths:
  - "src/pages/TimeTracking.tsx"
  - "src/pages/MyHours.tsx"
  - "src/pages/HoursReport.tsx"
  - "src/lib/workingHours.ts"
  - "src/lib/hoursAccounting.ts"
  - "src/hooks/usePermissions.ts"
  - "src/components/ProtectedRoute.tsx"
  - "src/components/admin/PermissionMatrix.tsx"
  - "src/components/InstallPromptDialog.tsx"
  - "src/pages/Auth.tsx"
  - "supabase/migrations/20260717090000_mitarbeiter_keine_zahlen.sql"
  - "supabase/migrations/20260717110000_zahlen_leaks_teil2.sql"
  - "supabase/migrations/20260529140000_email_self_registration.sql"
---
# Zeiterfassung, Rollen, Registrierung

## Regelarbeitszeit (Christoph 20.07., zentral in `src/lib/workingHours.ts`)
- Mo–Do 07:30–12:00 + 13:00–16:30 = 8 h; Fr 07:30–12:00 + 13:00–15:30 = 7 h; 39-h-Woche. ZA muss dazu passen.
- Gesamtstunden = tatsächlich gearbeitet; Urlaub/Krank/Feiertag/ZA/Weiterbildung stehen daneben
  („+ Urlaub 8,00 h · Weiterbildung 12,50 h = … inkl. Sonderzeiten“, 21.09. Frage aus dem Büro). Excel-Export summiert
  weiter inkl. Sonderzeiten. Rechenkern `stundenAufteilung`/`sonderzeitenText` in `hoursAccounting.ts`.
- Urlaubskonto zählt live aus der Zeiterfassung (Urlaub wird dort direkt eingetragen, `leave_requests` nutzt niemand;
  Ganztag = 1, Teiltag anteilig, 31.08.).
- 24.08.: Umbau „Monatssoll ab Eintritt, Excel-Formeln, Teilabwesenheit“ wurde komplett zurückgenommen (Revert `e37329d`)
  – nicht ungefragt neu aufrollen.
- Arbeitsort heißt überall „Firma“ statt „Werkstatt“ (28.07.).

## Rollen – Mitarbeiter sehen keine Zahlen
- `app_role`: administrator | vorarbeiter | mitarbeiter. Michael Lutz hat die Rolle **mitarbeiter** (Christoph 16.07.).
- Mitarbeiter: nur Zeiterfassung, Regieberichte, Bautagesberichte (Christoph: „mitarbeiter nichts mit zahlen sehen …
  kein betriebswissen“). Abgesichert in RLS, nicht nur in der Oberfläche (Migrationen `20260717090000`, `…110000`):
  EK/Kalkulation, `app_settings` (nur Whitelist `einheiten`), Zahlungen, Mahnungen, `number_ranges` nur Admin;
  Material-Preise über die maskierte Ansicht `material_entries_ansicht`.
- Rechte zusätzlich über `role_permissions` (Admin-Reiter `PermissionMatrix`).

## Registrierung & Installation
- Nur Selbstregistrierung per E-Mail mit Freigabe durch den Admin (`is_active=false` bis Freigabe, kein anderer Weg,
  29.05.). `mailer_autoconfirm` an, keine Mail-Bestätigung. Neue Konten mit der Bootstrap-Adresse werden nicht mehr
  automatisch Admin (25.10.).
- SMS-Einladung verlinkt auf die Wurzel-URL, nicht `/auth` – Unterseiten liefern beim Hoster 404 (kein `vercel.json`).
- Offen seit August: Eine Mitarbeiterin mit Samsung-Browser bekommt die App nicht auf den Startbildschirm;
  `InstallPromptDialog` hat noch keine Samsung-Internet-Anleitung.
