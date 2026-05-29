# Holzbau Lutz — Angebots-, Rechnungs- & Zeiterfassungs-App

Interne Anwendung der **Holzbau Lutz OG** (Zimmerei & Holzbau, Am Sportplatz 3, 6642 Stanzach) für
Angebote, Auftragsbestätigungen, Rechnungen, Materialkalkulation, Kundenverwaltung,
Projekte/Plantafel und Zeiterfassung.

## Tech-Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Auth, Storage, Edge Functions)

## Lokale Entwicklung

```sh
npm install
npm run dev
```

Die App erwartet in `.env`:

```
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_KEY="<publishable-key>"
```

## Build

```sh
npm run build
```
