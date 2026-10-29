---
paths:
  - "src/lib/stundenabgleich.ts"
  - "src/pages/ProjectOverview.tsx"
  - "src/pages/Projects.tsx"
  - "src/components/dashboard/StundenabgleichWidget.tsx"
  - "src/components/project/ProjektNachkalkulation.tsx"
  - "src/components/PurchaseInvoiceUploadDialog.tsx"
  - "supabase/migrations/20260914100000_disturbances_mitarbeiter_anzahl.sql"
---
# Stundenabgleich (Angebot vs. gebucht) und Nachkalkulation

## Stundenabgleich (Startseite-Widget + Projektübersicht, Kern in `src/lib/stundenabgleich.ts`)
- Soll = Summe aller ANGENOMMENEN Angebote des Projekts (Nachtrag als zweites Angebot erhöht das Soll), je Zeile
  `arbeitszeit_minuten × Menge`; Zeilen mit Stunden-Einheit (Std/h/Stunde) ohne Minuten zählen 60 min/Einheit.
  Aufschlüsselung „Woraus sich die X Std. ergeben“ je Position, Badge „aus Kalkulation“.
- Anlass 16.07. (Christoph, Wolfgang Bauer): „Das muss ja genau 25 Stunden sein“ – die Katalog-Positionen enthalten aber
  schon kalkulierte Arbeitszeit (60,2 h) + 25 h explizit = 85,2. Darum die Aufschlüsselung.
- Regieberichte zählen nur gegen das Angebot, wenn das Angebot selbst Regiestunden enthält; sonst daneben
  „+ 3,0 Regiestd. zusätzlich (nicht im Angebot)“. Kein Schalter (Natalie 11.09.).
- Mannstunden: Regiebericht speichert Stunden JE Mitarbeiter; ausgewertet/verrechnet wird
  `stunden × disturbances.mitarbeiter_anzahl` (1,5 h × 2 = 3,0, Natalie 11.09.).
- Gebucht wird weiter nur aufs Projekt, nicht aufs Angebot. Regel an den Kunden: **ein Projekt je Auftrag**
  (z. B. „Häsele – Dach/Terrasse“ und „Häsele – Fenster“), anlegbar aus dem Angebot über „Projekt anlegen“ (11.09.).

## Nachkalkulation (`ProjektNachkalkulation`, nur Admin)
- Standardmäßig eingeklappt („nur Nachkalkulation öffnen“, 16.07.).
- Formel: Erlöse netto (SR ohne die ARs, Entwürfe zählen nicht) − Lohn (Std × Stundenlohn × `lohnnebenkosten_faktor`
  aus app_settings, Standard 1,8) − Material (Verbrauch × EK) − Fremdleistungen (Eingangsrechnungen netto).
- Eingangsrechnungen müssen beim Hochladen einem Projekt zugeordnet werden können – sie fließen in die Nachkalkulation.
  Erkannte Positionen sind manuell korrigierbar, Positionen auf Projekte aufteilbar (17.07.).
