---
paths:
  - "src/pages/InvoiceTemplates.tsx"
  - "src/components/PositionComponentsEditor.tsx"
  - "src/components/KalkulationsExcelAnsicht.tsx"
  - "src/components/KalkulationFields.tsx"
  - "src/components/KatalogKalkulationPopover.tsx"
  - "src/components/KatalogNachschlagen.tsx"
  - "src/components/MaterialCatalogDialog.tsx"
  - "src/lib/kalkulation.ts"
  - "src/lib/positionen.ts"
  - "supabase/migrations/20260710090000_materialien_positionen.sql"
  - "supabase/migrations/20260710120000_import_positionen.sql"
  - "supabase/migrations/20260717130000_ist_stundensatz_flag.sql"
---
# Kalkulation & Katalog („Materialien & Kalkulation“)

## Modell (nach der Kunden-Excel, Juli 2026)
- Zwei Ebenen in `invoice_templates.art`: `material` (EK) und `position` (aus Komponenten in `position_components`).
  Die alten 174 Positionen wurden am 10.07. ersetzt durch das Excel-Blatt POSITIONEN (POS-0001…0132)
  (Christoph: „die alten Positionen, die brauchen wir nicht mehr“). Nur MATERIALIEN + POSITIONEN importiert – Zeilen aus
  anderen Blättern (Dachelemente, Sichtdach …) bewusst nicht.
- Rechnung je Komponente (`src/lib/positionen.ts`, gespiegelt in DB-Trigger `recompute_position_price`):
  Material = Menge × EK × (1+Verschnitt %) × (1+Aufschlag %); Lohn = Std × Satz; Sonstiges = Menge × Betrag.
  Material-EK-Änderung rechnet alle Positionen nach (`trg_material_recompute`, `trg_component_recompute`).
- Stundensätze aus der Excel: `DEFAULT_STUNDENSATZ = 52` (Mittellohn), `REGIE_STUNDENSATZ = 50` (`src/lib/kalkulation.ts`).
- Stundensätze sind ein echtes Katalog-Merkmal `ist_stundensatz` (Migration `20260717130000`) – keine Namens-/Einheiten-
  Heuristik (Christoph: „fassadengerüst an und abtransport und zellulose helfer sind keine arbeitszeiten“). Eigener Reiter
  „Stundensätze“ neben Positionen/Materialien.

## Oberfläche
- Kalkulation soll aussehen „wie Excel … dass das dann nicht so kompliziert ist“: `PositionComponentsEditor` als
  Tabelle, `KalkulationsExcelAnsicht` = alle Positionen als ein Blatt (Umschalter Liste | Excel-Ansicht).
- „Als Kopie speichern“ → man landet IN der Kopie (20.07.). Produktgruppen überall zugeordnet; Feld heißt
  „Produktgruppe / Kategorie“. Einheit m³ vorhanden.
- Neuer Lieferant / neue Produktgruppe: Eingabefeld direkt im Formular („+ Neuer Lieferant…“), kein Browser-`prompt()` –
  den zeigt die App am Handy nicht an (Natalie 31.08. und 05.10.; der neue Lieferant muss danach im Feld stehen bleiben).
- „Katalog nachschlagen“ im Beleg öffnet den Katalog als Fenster NEBEN dem Editor, ohne Speichern/Seitenwechsel (21.09.).
- Im Angebot über das Rechner-Symbol einer Position: „Stunden / Material für diese Zeile anpassen“ oder als neue
  Katalog-Position speichern (13.10., Natalie).

## Preise im Angebot später aktualisieren – bewusst so
- Angebotszeilen tragen einen Kalkulations-Snapshot + `kalkulation_template_id` / `katalog_vk`; Banner listet geänderte
  Positionen („Pos. N · Name € alt → € neu“), Knopf „Preise aktualisieren“ zieht ALLE auf den aktuellen Katalog.
- Ein Schutz für „verhandelte Preise“ wurde am 16.07. wieder zurückgenommen. Christoph: „Das ist schon bewusst so
  gemacht“ – im Baubetrieb ändert man die Preise oft nach einem halben Jahr. Nicht wieder einbauen.
- Stattdessen automatische Revision: Speichern nach Aktualisierung erzeugt `AN…-R2` (ohne neue Nummer), Original wird
  archiviert (`invoices.revision`, `vorgaenger_id`, Migration `20260716140000_angebot_revisionen`).
- Stundenlohn-Anpassung gilt nur für das jeweilige Angebot, nicht für die ganze Kalkulation.
