# Holzbau Lutz — Zimmerei & Holzbau

Individuelle App für **Holzbau Lutz**. Projekte, Angebote mit
Ausschreibungs-Import, Rechnungswesen inkl. E-Rechnung, Bautagesberichte,
Zeiterfassung.

> Dieses Dokument beschreibt nur, **was ist** — es enthält keine Vorgaben,
> wie gearbeitet werden soll.

---

## Stack

| | |
|---|---|
| Frontend | React 18 + TypeScript, Vite |
| UI | shadcn/ui (Radix) + Tailwind, Alias `@` → `src/` |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| PWA | `vite-plugin-pwa` |
| Deploy | **kein `vercel.json`** — wie monti.pro, anders als die übrigen Apps |
| Tests | Playwright (`tests/`, 4 Specs) |
| Git | `main` → `git@github.com:enapetschnig/holzbaulutz.git` |

**Supabase:** `rjrknonzqwttmcpgjamw` — `.env` und `config.toml` stimmen überein.

> ## 🔴 Die Supabase-CLI zeigt auf das falsche Projekt
>
> `supabase/.temp/linked-project.json` (Stand 14.04.2026):
>
> ```json
> {"ref":"zbxizeirecoipqvxymdx","name":"Monti.pro", …}
> ```
>
> Das ist **die Datenbank von monti.pro**, nicht die von Holzbau Lutz.
>
> Die App selbst arbeitet korrekt: `.env` und `config.toml` zeigen beide auf
> `rjrknonzqwttmcpgjamw`. Betroffen ist nur die CLI-Verknüpfung — und die
> sticht die `config.toml`.
>
> **Damit würde `supabase db push`, `supabase db reset` oder
> `supabase functions deploy` aus diesem Ordner heraus auf der
> Produktivdatenbank von monti.pro landen.**
>
> Vermutliche Ursache: Der Ordner wurde aus monti.pro dupliziert, nachdem dort
> `supabase link` gelaufen war — die Zeitstempel in beiden `.temp`-Ordnern sind
> identisch (14.04.2026 10:56).
>
> Behebung (eine Zeile):
>
> ```bash
> supabase link --project-ref rjrknonzqwttmcpgjamw
> # oder: rm -rf supabase/.temp   → beim nächsten Befehl neu verknüpfen
> ```
>
> `supabase/.temp/` steht in der `.gitignore` — der Fehlstand existiert also
> nur auf diesem Rechner, nicht im Repo.
>
> Dieselbe Fehlverknüpfung liegt bei `handwerkssoftware` vor.

**Umgebungsvariablen:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`
(wie monti.pro; die übrigen Apps nutzen andere Variablennamen)

Primärfarbe: `--primary: 163 73% 20%` (Dunkelgrün) in `src/index.css`

## Befehle

```bash
npm run dev     # Dev-Server
npm run build   # Produktions-Build
npm run lint    # ESLint
npx playwright test
```

---

## Herkunft

Fork der gemeinsamen Ur-App (Basis `20251105065433_33daeb17-…`).
**200 Migrations — die meisten aller Apps.** Letzte:
`20260720100000_invoices_leistungsstand.sql`.

**Nächster Verwandter: `monti.pro`.** Beide teilen `useConfigOptions`,
`ConfigOptionsManager`, das Rechnungs-Layoutsystem, `hoursAccounting` und die
`parse-*`-Edge-Functions. Wo monti.pro auf WhatsApp und Kalender setzt, setzt
Lutz auf Kalkulation und Ausschreibungen.

---

## Rollen

Enum `app_role`: `administrator` | `mitarbeiter`, später ergänzt um `vorarbeiter`.
Feingranulare Rechte über `usePermissions.ts`, Routen über `ProtectedRoute.tsx`.

---

## Module

`src/pages/` — 30 Seiten:

**Projekte**
`Projects`, `ProjectDetail`, `ProjectOverview`, `ConstructionSites`, `Reports`
Komponenten in `src/components/project/`

**Angebote & Ausschreibungen**
`OfferPackages`, `AusschreibungImport`
Fachlogik: `lib/ausschreibung.ts`, `lib/kalkulation.ts`, `lib/positionen.ts`

**Rechnungswesen**
`Invoices`, `InvoiceDetail`, `InvoiceTemplates`, `PurchaseInvoices`
Layout-Engine: `lib/invoiceLayoutTypes`, `lib/loadLayout`, `lib/invoiceHtml`,
`lib/pdfLetterhead`, `lib/mahnungSettings`, Hook `useInvoiceLayout`
**E-Rechnung:** `lib/erechnung.ts`

**Bautagesberichte**
`Bautagesberichte`, `BautagesberichtDetail`
Versand über Edge Function `send-bautagesbericht-report`

**Zeiterfassung**
`TimeTracking`, `MyHours`, `HoursReport`, `FreelancerHours`
Rechenkern: `lib/hoursAccounting.ts`, `lib/stunden.ts`

**Material**
`MaterialList` — `lib/materialliste.ts`, `lib/materialbedarf.ts`
Einlesen über `parse-material-file` und `parse-voice-material`

**Kunden**
`Customers`

**Planung**
`ScheduleBoard` — Komponenten in `src/components/schedule/`

**Sonstiges**
`Employees`, `Disturbances`, `DisturbanceDetail`, `MyDocuments`, `Notepad`,
`Dashboard`, `Admin`, `Auth`, `Index`, `NotFound`

---

## Ausschreibungs-Import

`src/lib/ausschreibung.ts`. Aus dem Kopf der Datei:

> *„Ausschreibungs-Import: ÖNORM-A-2063-Datenträger (.onlv) und GAEB-DA-XML
> (.x81/.x82/.x83) einlesen und in Angebots-Positionen umwandeln — Preise trägt
> der Nutzer danach im Angebots-Editor ein. Der Parser arbeitet
> namespace-agnostisch über localName."*

Unterstützte Formate: `.onlv` (ÖNORM A 2063), `.x81` / `.x82` / `.x83` (GAEB DA XML).
Im Portfolio nur hier.

## E-Rechnung

`src/lib/erechnung.ts`. Aus dem Kopf der Datei:

> *„E-Rechnung im österreichischen Standard ebInterface 6.1
> (http://www.ebinterface.at — akzeptiert u. a. von e-rechnung.gv.at). Erzeugt
> aus einer gespeicherten Rechnung eine strukturierte XML-Datei zum Download."*

Im Portfolio nur hier.

---

## Edge Functions

`supabase/functions/` — 14 Stück:

| Function | Zweck |
|---|---|
| `check-vat` | UID-Nummer prüfen |
| `create-team-time-entries` | Zeiteinträge fürs Team |
| `create-user` / `delete-user` | Nutzerverwaltung |
| `generate-invoice-pdf` | Rechnungs-PDF |
| `migrate-sick-notes` | Krankmeldungen migrieren |
| `parse-invoice-document` | Eingangsrechnung einlesen |
| `parse-material-file` | Materialdatei einlesen |
| `parse-voice-material` | Material per Sprache erfassen |
| `polish-text` | Textverbesserung (`verify_jwt = false`) |
| `send-bautagesbericht-report` | Bautagesbericht versenden |
| `send-disturbance-report` | Störungsmeldung versenden |
| `send-invitation` | Einladung |
| `send-sms-invite` | Einladung per SMS |

---

## Konfigurierbarkeit zur Laufzeit

Tabelle `admin_config_options`, gelesen über `src/hooks/useConfigOptions.ts`,
gepflegt über `src/components/admin/ConfigOptionsManager.tsx`.
Ergänzend: `useProjectStatuses`, `useEinheiten`, `lib/statusColors`,
`lib/executingCompanies`, `lib/documentTypes`.

## Weitere Hooks

`useAvailableEmployees`, `useHiddenUserIds`, `useSessionKeepalive`,
`useUnsavedChangesWarning`

## Weitere Fachlogik

`auditLog` · `projectFiles` · `mergeDuplicateProjects` · `logoLoader` ·
`pdfGenerator` · `pdfPhotoGrid` · `pdfToImage` · `pdfUploader` ·
`documentTextsLoader` · `allgemeineAngaben` · `searchUtils` · `dateFormat` ·
`calendarCategories` · `workingHours`

---

## Besonderheiten

- **Ausschreibungs-Import** (ÖNORM/GAEB) — einzigartig im Portfolio
- **E-Rechnung** nach ebInterface 6.1 — einzigartig im Portfolio
- **Meiste Migrations** aller Apps (200)
- **`vorlagefunktionenapp/`** — vollständige Kopie einer anderen App als
  Nachschlagewerk (identischer Stand wie in monti.pro). Gehört nicht zum Build.
