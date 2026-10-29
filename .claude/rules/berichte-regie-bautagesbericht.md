---
paths:
  - "src/components/BautagesberichtForm.tsx"
  - "src/components/DisturbanceForm.tsx"
  - "src/components/TaetigkeitenEditor.tsx"
  - "src/lib/berichtZeiten.ts"
  - "src/pages/Bautagesberichte.tsx"
  - "src/pages/BautagesberichtDetail.tsx"
  - "src/pages/Disturbances.tsx"
  - "src/pages/DisturbanceDetail.tsx"
  - "supabase/functions/parse-voice-taetigkeiten/**"
  - "supabase/functions/send-bautagesbericht-report/**"
  - "supabase/functions/send-disturbance-report/**"
  - "supabase/functions/create-team-time-entries/**"
  - "supabase/migrations/20260720120000_berichte_taetigkeiten_arbeitsort.sql"
---
# Regieberichte (`disturbances`) und Bautagesberichte

- Begriff: „Regiebericht“ = Tabelle/Seiten `disturbances` (Altname aus der Ur-App). Bautagesberichte waren beim Umbau
  (Mai 2026) zuerst entfernt und sind seit Juli wieder aktiv.
- Bautagesbericht: einfach speichern, KEINE Unterschrift, Status „erstellt“, PDF automatisch erzeugen und im Projektordner
  ablegen (17.07.). Jeder aktive Mitarbeiter sieht ALLE Bautagesberichte, schreiben nur eigene.
- Statt von–bis nur Stunden je Tätigkeit („1 h aufräumen, 2,5 h Stapler richten“, Christoph 20.07.):
  JSONB `taetigkeiten` `[{text, stunden}]` an `bautagesberichte` und `disturbances`; `stunden` bleibt die führende Summe.
  `start_time`/`end_time` sind nullable (auch in `time_entries`) – KEINE erfundenen Uhrzeiten eintragen (die hätten
  Überschneidungswarnungen und stille Unique-Verluste erzeugt).
- Projektauswahl steht ÜBER den Tätigkeiten. Tätigkeiten diktierbar: Edge Function `parse-voice-taetigkeiten`
  (gpt-4o-mini-transcribe → whisper-1, dann JSON; „zweieinhalb“ = 2,5, „45 Minuten“ = 0,75).
- Arbeitsort-Umschalter Baustelle / „🏢 Firma“ nur im Bautagesbericht. Gespeicherter Wert bleibt `werkstatt`
  (DB-Constraint), Anzeige „Firma“ seit 28.07.; Firma → kein Projekt, `kunde_name` „Firma (intern)“, nicht verrechenbar.
- Regieberichte buchen nicht doppelt in die Arbeitszeit: Regiestunden erscheinen beim Projekt („Regiestunden“-Topf,
  Ordner, ZIP-Download) und beim Rechnungs-Import über „Projektzeiten importieren“ mit vorausgewähltem Satz
  „Regiestunde Facharbeiter“; der Knopf „Aus Regiebericht“ ist weg (17.07.).
- Versand der Berichte per Resend; `reply_to` = Einstellung `disturbance_report_email`.
