-- Kumulierte Teilrechnung: je Position wird der kumulierte Leistungsstand
-- (in %) auf der Rechnung gespeichert — die nächste Teilrechnung liest den
-- Stand als "bisher %" vor. Format: {"1": 60, "2": 100, ...} (Position → %).
alter table public.invoices
  add column if not exists leistungsstand jsonb;
comment on column public.invoices.leistungsstand is
  'Kumulierter Leistungsstand je Position ({"<position>": prozent}) bei kumulierten Teil-/Anzahlungsrechnungen';
