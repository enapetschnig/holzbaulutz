# Holzbau Lutz — Zimmerei & Holzbau

Individuelle App für **Holzbau Lutz**. Projekte, Angebote mit
Ausschreibungs-Import, Rechnungswesen inkl. E-Rechnung, Bautagesberichte,
Zeiterfassung.

> Dieses Dokument beschreibt nur, **was ist** — es enthält keine Vorgaben,
> wie gearbeitet werden soll.

## Kundenakte (Stand 29.10.2026)

**Kunde:** Holzbau Lutz OG – Zimmerei & Holzbau, Am Sportplatz 3, 6642 Stanzach (Tirol) · info@holzbau-lutz.at ·
UID ATU67426948 (in `app_settings.firmen_uid`). Kunden: rund 140 Privat- und Geschäftskunden, v. a. Tirol
(Seed `supabase/seed/02_customers.sql`). Angebote nach ÖNORM B2110, „Angebot Zimmermannsarbeiten“, 1 Woche gültig.

**Entstehung:** Ende Mai 2026 aus der BKS-/Monti-App umgebaut (Rebrand, Kalender/WhatsApp/Protokolle entfernt),
eigenes Supabase-Projekt, Kalkulation nach der Kunden-Excel. Seitdem laufend Wünsche aus dem Büro.

**Wer benutzt die App:**
| Wer | Rolle | Was |
|---|---|---|
| Natalie Frischmann | Büro | schreibt Angebote/Rechnungen, meldet fast alle Wünsche über den Melde-Knopf (app_key `holzbaulutz`) |
| Michael Lutz | mitarbeiter (ausdrücklich, Christoph 16.07.) | Zeiterfassung, Regie-/Bautagesberichte |
| Monteure | mitarbeiter / vorarbeiter | am Handy: Stunden, Berichte – sehen keine Zahlen |
| Christoph (`napetschnig.chris@gmail.com`) | Administrator | baut und betreut die App |

Antworten an Natalie beginnen mit „Liebe Natalie“ / „Hallo Natalie“, kurz, mit Menüpfad
(z. B. „Rechnungen & Angebote → Angebot → Umwandeln in … Schlussrechnung“).

**Fachbegriffe:**
| Begriff | Bedeutung |
|---|---|
| Regiebericht / Regiestunden | Stundenlohn-Arbeiten außerhalb des Angebots; Tabelle `disturbances` |
| Mannstunden | Stunden × Anzahl Mitarbeiter im Regiebericht |
| AR / SR / kumulierte TR | Anzahlungs-, Schluss-, kumulierte Teilrechnung (Leistungsstand %) |
| EV | Eventualposition – nur Einheitspreis, zählt in keiner Summe |
| Position / Material / Stundensatz | Katalog in „Materialien & Kalkulation“ (`invoice_templates`) |
| Stundenabgleich | Angebotsstunden vs. gebuchte Stunden je Projekt |
| Nachkalkulation | Erlös − Lohn − Material − Fremd je Projekt (nur Admin) |
| Firma (Arbeitsort) | intern, nicht verrechenbar; in der DB `werkstatt` |
| Mittellohn / Regiesatz | 52 €/h / 50 €/h (Excel) |

**Feste Regeln und No-Gos:**
- Mitarbeiter sehen keine Zahlen (EK, Preise, Zahlungen, Kalkulation) – in RLS abgesichert, nicht nur in der Oberfläche.
- „Preise aktualisieren“ zieht bewusst ALLE Angebotspreise auf den Katalog (Christoph 16.07.: „Das ist schon bewusst so
  gemacht“); stattdessen automatische Angebots-Revision. Keinen „Schutz verhandelter Preise“ einbauen.
- Ein Projekt je Auftrag; gebucht wird aufs Projekt, nicht aufs Angebot.
- Nach Änderungen keine browser-use-Durchläufe (Christoph 17.07.: „hör auf mit browser use ich habe dir das problem ja
  eh geschildert“) – Typecheck + Build + Push genügen, Christoph testet selbst. Ausnahme: ausdrücklich verlangt oder RLS-Beweis.
- Echte Kundendaten (z. B. Projekt Wolfgang Bauer, Häsele) nur lesen; Testdaten (QA-User, Belege, Nummernkreise) restlos aufräumen.
- Keine Mails an echte Kunden beim Testen.

**Stand-Hinweis (geprüft 29.10.2026):** Einige Zahlen unten sind vom April/Mai: inzwischen 209 Migrationen
(letzte `20261025170000_signup_bootstrap_absichern.sql`) und 18 Edge Functions (neu u. a. `parse-voice-taetigkeiten`,
`send-invoice-email`, `sprache-zu-text`, `wunsch-datei`). Bautagesberichte sind aktiv. Die CLI-Fehlverknüpfung besteht
im Haupt-Ordner WEITER: `supabase/.temp/project-ref` = `zbxizeirecoipqvxymdx` (monti.pro) – CLI-Befehle immer mit
`--project-ref rjrknonzqwttmcpgjamw`. Produktion: `lutz.handwerkapp.at`, Vercel-Projekt `holzbaulutz`; ohne
`vercel.json` liefert jede Unterseite beim Direktaufruf 404 (geprüft: `/invoices` → 404).

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

---

## Technik-Eckdaten (ergänzt 29.10.2026)

- Supabase `rjrknonzqwttmcpgjamw` · GitHub `enapetschnig/holzbaulutz` · Vercel-Projekt `holzbaulutz` →
  `lutz.handwerkapp.at`. Push auf `main` = Deploy. Commits mit `napetschnig.chris@gmail.com`, sonst baut Vercel nicht.
- Gates vor Commit: `npx tsc -p tsconfig.app.json --noEmit` (Baseline 21 alte Fehler, keine neuen; Stand Aug. 2026)
  und `npm run build` (vite prüft keine Typen). Ein `npm run check` gibt es hier nicht.
- Migrationen: Datei in `supabase/migrations/`, eingespielt über die Supabase-Management-API
  (`POST /v1/projects/rjrknonzqwttmcpgjamw/database/query`, Schlüssel aus `~/.config/hw/zugangsdaten.env`, nie ausgeben;
  Browser-User-Agent nötig, sonst Cloudflare 1010). NICHT `supabase db push` (CLI-Link zeigt auf monti.pro).
- Edge Functions: `npx supabase functions deploy <name> --project-ref rjrknonzqwttmcpgjamw`.
  Secrets nur als Supabase-Secrets (Resend `RESEND_API_KEY`/`RESEND_FROM_EMAIL`, OpenAI, Twilio) – nie ins Frontend/Git.
- PWA: nach einem Update sieht der Nutzer Neues erst nach Neuladen bzw. App neu öffnen.

## Wissen nach Thema

| Thema | Datei | Wann lesen |
|---|---|---|
| Kalkulation, Katalog, Preise aktualisieren, Revisionen | `.claude/rules/kalkulation-katalog.md` | „Materialien & Kalkulation“, Positionen/Komponenten, Lieferanten |
| Angebot/Rechnung, AR/SR, Entwurf, E-Mail-Versand, Nummern, E-Rechnung | `.claude/rules/angebot-rechnung.md` | Arbeit an `InvoiceDetail`, Belegliste, PDF |
| Stundenabgleich, Nachkalkulation | `.claude/rules/stundenabgleich-nachkalkulation.md` | Projektübersicht, Startseiten-Widget, Eingangsrechnung → Projekt |
| Regie- und Bautagesberichte | `.claude/rules/berichte-regie-bautagesbericht.md` | Berichtsformulare, Tätigkeiten, Diktat, Berichts-PDF |
| Zeiterfassung, Rollen/Rechte, Registrierung | `.claude/rules/zeiterfassung-und-rollen.md` | Stunden, Urlaub, Mitarbeiter-Sicht, RLS, Installation |

**Verlauf:** Ein `JOURNAL.md` gibt es hier (noch) nicht; die Historie steht in ausführlichen Commit-Texten
(`git log --grep="<Stichwort>"`). `AGENTS.md` ist eine exakte Kopie dieser Datei (für Codex); bei Änderungen beide gleich halten.

## Wissen ablegen (für jede KI – auch den Roboter)
- Diese Datei ist die kurze Kundenakte und bleibt unter 25 KB. Hier nur: wer der Kunde ist, feste Regeln, Technik, Index.
- Neue Erkenntnis, Fallstrick oder Entscheidung zu einem Thema → in die passende Datei unter `.claude/rules/`
  (mit Datum und, wenn von Christoph/Kunde, dem Zitat). Gibt es kein passendes Thema: neue Datei mit `paths:` auf die
  betroffenen Code-Ordner anlegen und oben im Index eintragen.
- Ausführliche Protokolle, Testberichte, Abläufe → `JOURNAL.md` oder `research_notes/`, nicht hierher.
