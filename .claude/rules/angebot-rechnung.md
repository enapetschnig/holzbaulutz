---
paths:
  - "src/pages/InvoiceDetail.tsx"
  - "src/pages/Invoices.tsx"
  - "src/components/AbzugAnzahlungDialog.tsx"
  - "src/components/BelegMailDialog.tsx"
  - "src/components/ZahlFeld.tsx"
  - "src/lib/rechnungsEntwurf.ts"
  - "src/lib/invoiceHtml.ts"
  - "src/lib/pdfGenerator.ts"
  - "src/lib/erechnung.ts"
  - "src/lib/materialliste.ts"
  - "supabase/functions/send-invoice-email/**"
  - "supabase/functions/generate-invoice-pdf/**"
  - "supabase/migrations/20261023100000_invoice_items_negative_betraege.sql"
  - "supabase/migrations/20260717140000_nummernkreise_haerten.sql"
---
# Angebote, Rechnungen, Anzahlung/Schlussrechnung, Versand

## Ablauf wie in Österreich üblich
- Angebot → Anzahlungsrechnung(en) (AR) → Schlussrechnung (SR); die SR zieht die AR mit Rechnungsnummer ab.
- Anzahlung wird **netto unter den Positionen** abgezogen, USt auf den Rest (13.10., Natalie: „so sieht es keiner dass es
  sich um einen Bruttobetrag handelt“). Früher eigener roter Summenblock – entfernt, Abzug nur als Positionszeile (17.07.).
- Knopf „Anzahlung / Teilzahlung abziehen“ (`AbzugAnzahlungDialog`): Nummer, Datum, Betrag brutto/netto → Netto-
  Abzugszeile; für Teilzahlungen, die vor der App gestellt wurden (Natalie 23.10.).
- Minus in Menge/Einzelpreis erlaubt (`ZahlFeld` statt `<input type=number>`, das ein angefangenes „-“ auf 0 setzte);
  DB-Check `invoice_items_preis_nonneg` entfernt, Katalog bleibt ≥ 0, Beleg gesamt muss > 0 sein (23.10.).
- Kumulierte Teilrechnung: Modus „Leistungsstand“ im AR-Dialog, `invoices.leistungsstand` (jsonb Position → %),
  Rabatte eingerechnet (Zeilenrabatt × Belegfaktor) – sonst wären 100 % nie erreichbar (20.07.).
- Eventualpositionen (EV-Knopf je Zeile, `invoice_items.eventual`): nur Einheitspreis, zählen in keiner Summe,
  kein Stunden-Soll, nicht in der E-Rechnung (31.08.).

## Entwurf / Zwischenspeichern (13.10.)
- „Zwischenspeichern“ = ohne Nummer (Platzhalter `ENTWURF-…`, `src/lib/rechnungsEntwurf.ts`), beliebig oft;
  „Ausstellen“ vergibt die fortlaufende Nummer und sperrt. Beide Knöpfe auch oben im Seitenkopf (14.10., Natalie fand sie
  unten nicht). Entwürfe zählen nirgends als Erlös/Anzahlung, PDF „ENTWURF – Rechnung“ ohne QR.
- Gesperrte Typen: rechnung, anzahlungsrechnung, schlussrechnung; erstes Speichern fragt per `window.confirm`.

## Versand per E-Mail (13.10.)
- `BelegMailDialog` → Edge Function `send-invoice-email` (Resend, Absender aus Secret `RESEND_FROM_EMAIL`,
  reply_to = Büro-Adresse aus `disturbance_report_email`). Anhang = exakt das Vorschau-PDF. Entwürfe werden abgelehnt.
  Vermerk `versendet_am`/`versendet_an`. Echte Mails an Kunden nur auf Wunsch – Testversand mit Service-Key ohne Vermerk.

## Nummern, Storno, Gutschrift
- `next_document_number` mit Zeilensperre, Format-Pflicht `{NNN}`/`{N}`, typabhängigem Unique-Check und Jahres-Reset
  (`number_ranges.jahr`); im Admin vorab definierbar. Storno: `next_storno_nummer` mit Advisory-Lock + Unique-Index (16.07.).
- Revision eines Angebots verbraucht keine neue Nummer (siehe `kalkulation-katalog.md`).
- Bewusst offen (Audit 17.07.): Gutschrift-Storno-Rollback bei teilweiser Anrechnung; Nummernlücke bei Insert-Fehler nach RPC.

## Recht & PDF
- § 11 UStG Pflichtangaben, Reverse Charge Bauleistungen § 19 Abs. 1a: USt 0 bei `reverse_charge` (02.06.).
- E-Rechnung ebInterface 6.1 (`src/lib/erechnung.ts`) als XML-Download.
- PDF-Logo höchstens 24 mm hoch (`MAX_LOGO_H`), sonst überlappt es die Anschrift (DIN 5008).
- „Materialliste erstellen“ (PDF) aus dem Angebot; Katalog-Materialien zählen mit Angebotsmenge und aktuellem EK,
  Stundensätze und EV-Positionen nicht (Fix 04.09., Natalie). Ablage im Projektordner „Materialliste“.
