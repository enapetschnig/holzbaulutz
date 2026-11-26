---
paths:
  - "supabase/**"
---
# Supabase-Fehlerprotokolle (Nachtschicht) – bekannte harmlose Einträge

- 26.11.2026: `ERROR TREFFER:…` (P0001, application_name `mgmt-api`, `DO`-Block mit `raise exception 'TREFFER:%'`) = händische Such-Abfragen über die Management-API (25.11. 09:03/09:04 UTC), die ihr Ergebnis absichtlich per Exception ausgeben – kein App-Fehler, nichts zu tun.
