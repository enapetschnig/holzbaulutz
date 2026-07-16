-- Kalkulations-Snapshot je Angebots-/Rechnungsposition:
-- Beim Übernehmen einer Katalogposition wird die dahinterliegende Kalkulation
-- (Komponenten + VK + Arbeitszeit) als JSON eingefroren. Damit ist für jede
-- Position nachvollziehbar, WAS aus dem internen Katalog kam und wie sie
-- damals kalkuliert war — und der ursprüngliche Stand bleibt wiederherstellbar,
-- auch wenn der Katalog später geändert wird oder ein Fehler passiert.
alter table public.invoice_items
  add column if not exists kalkulation_snapshot jsonb;

comment on column public.invoice_items.kalkulation_snapshot is
  'Eingefrorene Katalog-Kalkulation zum Zeitpunkt der Übernahme: {template_id, name, vk_netto, arbeitszeit_minuten, stand, komponenten:[{typ,bezeichnung,einheit,menge_pro_einheit,preis,verschnitt_prozent,aufschlag_prozent}]}';

-- Backfill für bestehende katalogverknüpfte Positionen: aktueller Katalogstand
-- als Snapshot (bester verfügbarer Stand — die Angebote sind jung, der Katalog
-- seither unverändert).
update public.invoice_items ii
   set kalkulation_snapshot = jsonb_build_object(
     'template_id', t.id,
     'name', coalesce(t.kurzbezeichnung, t.name),
     'vk_netto', t.vk_netto,
     'arbeitszeit_minuten', t.arbeitszeit_minuten,
     'stand', now(),
     'komponenten', coalesce((
       select jsonb_agg(jsonb_build_object(
         'typ', pc.typ,
         'bezeichnung', pc.bezeichnung,
         'einheit', pc.einheit,
         'menge_pro_einheit', pc.menge_pro_einheit,
         'preis', pc.preis,
         'verschnitt_prozent', pc.verschnitt_prozent,
         'aufschlag_prozent', pc.aufschlag_prozent
       ) order by pc.sort_order)
       from public.position_components pc
       where pc.position_template_id = t.id
     ), '[]'::jsonb)
   )
  from public.invoice_templates t
 where t.id = ii.kalkulation_template_id
   and ii.kalkulation_snapshot is null;
