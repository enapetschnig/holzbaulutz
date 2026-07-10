-- ============================================================================
-- Neuimport POSITIONEN aus "Z_Kalkulation Vorlage 2026 Material und Positionen.xlsx"
-- (Arbeitsmappe POSITIONEN). Ersetzt die alten Einzel-Kalkulations-Positionen
-- komplett durch das Komponenten-Modell: Lohn-Zeilen (Std/EH x Satz),
-- Material-Zeilen (live mit der MATERIALIEN-Liste verknuepft) und Pauschalen.
-- VK je Position wird vom Trigger recompute_position_price berechnet.
-- ============================================================================

DELETE FROM public.invoice_templates WHERE art = 'position';

INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Statische Berechnung und Werksatzplanung', 'Statische Berechnung und Werksatzplanung', 'Statische Berechnung und Werksatzplanung', 'Std', 'Allgemein', 'POS-0001', 'POS-0001', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Baustelleneinrichtung', 'Baustelleneinrichtung', 'Baustelleneinrichtung', 'Pa', 'Allgemein', 'POS-0002', 'POS-0002', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Räumen der Baustelle', 'Räumen der Baustelle', 'Räumen der Baustelle', 'Pa', 'Allgemein', 'POS-0003', 'POS-0003', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Baukran liefern und aufstellen und wieder Abbauen', 'Baukran liefern und aufstellen und wieder Abbauen', 'Baukran liefern und aufstellen und wieder Abbauen', 'Pa', 'Allgemein', 'POS-0004', 'POS-0004', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0004' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        30.0, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0004' AND art='position' LIMIT 1),
        NULL, 'lohn', 'LKW mit Hiab', 'h',
        6.0, 100.0, 0, 0, 1);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Baukran vorhalten', 'Baukran vorhalten', 'Baukran vorhalten', 'Wo', 'Allgemein', 'POS-0005', 'POS-0005', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0005' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Pauschale', '',
        1, 750.0, 0, 0, 0);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Dachfanggerüst aufbauen und abbauen Regie', 'Dachfanggerüst aufbauen und abbauen Regie', 'Dachfanggerüst aufbauen und abbauen Regie', 'Std', 'Allgemein', 'POS-0006', 'POS-0006', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0006' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        1, 54.0, 0, 0, 0);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Dachfanggerüst vorhalten mxWo=VE', 'Dachfanggerüst vorhalten mxWo=VE', 'Dachfanggerüst vorhalten mxWo=VE', 'VE', 'Allgemein', 'POS-0007', 'POS-0007', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0007' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Pauschale', '',
        1, 0.5, 0, 0, 0);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Dachelement Satteldach bis 18°DN - gedämmt- Holz in eigener Pos.', 'Dachelement Satteldach bis 18°DN - gedämmt- Holz in eigener Pos.', 'Dachelement Satteldach bis 18°DN - gedämmt- Holz in eigener Pos.', 'm2', 'Dachkonstruktion', 'POS-0008', 'POS-0008', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Dachelement Satteldach bis 18°DN - ungedämmt- Holz in eigener Pos.', 'Dachelement Satteldach bis 18°DN - ungedämmt- Holz in eigener Pos.', 'Dachelement Satteldach bis 18°DN - ungedämmt- Holz in eigener Pos.', 'm2', 'Dachkonstruktion', 'POS-0009', 'POS-0009', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Dachelement Pultldach bis 18°DN - gedämmt- Holz in eigener Pos.', 'Dachelement Pultldach bis 18°DN - gedämmt- Holz in eigener Pos.', 'Dachelement Pultldach bis 18°DN - gedämmt- Holz in eigener Pos.', 'm2', 'Dachkonstruktion', 'POS-0010', 'POS-0010', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Dachelement Pultdach bis 18°DN - ungedämmt- Holz in eigener Pos.', 'Dachelement Pultdach bis 18°DN - ungedämmt- Holz in eigener Pos.', 'Dachelement Pultdach bis 18°DN - ungedämmt- Holz in eigener Pos.', 'm2', 'Dachkonstruktion', 'POS-0011', 'POS-0011', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Satteldachkonstruktion bis 18°DN - konventionell - Holz in eigener Pos.', 'Satteldachkonstruktion bis 18°DN - konventionell - Holz in eigener Pos.', 'Satteldachkonstruktion bis 18°DN - konventionell - Holz in eigener Pos.', 'm2', 'Dachkonstruktion', 'POS-0012', 'POS-0012', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0012' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Abbund', 'h',
        0.4466, 55.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0012' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Aufstellen 0,2*55+2+0,05*55', 'h',
        0.2, 55.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0012' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Verladen', 'h',
        0.05, 55.0, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0012' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Befestigungsmaterial', 'h',
        2.0, 1.0, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Satteldachkonstruktion über 18°DN - konventionell- Holz in eigener Pos.', 'Satteldachkonstruktion über 18°DN - konventionell- Holz in eigener Pos.', 'Satteldachkonstruktion über 18°DN - konventionell- Holz in eigener Pos.', 'm2', 'Dachkonstruktion', 'POS-0013', 'POS-0013', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0013' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Abbund', 'h',
        0.4466, 55.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0013' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Aufstellen 0,2*55+2+0,05*55', 'h',
        0.25, 55.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0013' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Verladen', 'h',
        0.05, 55.0, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0013' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Befestigungsmaterial', 'h',
        2.0, 1.0, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Pultdachkonstruktion bis 18° DN - konventionell- Holz in eigener Pos.', 'Pultdachkonstruktion bis 18° DN - konventionell- Holz in eigener Pos.', 'Pultdachkonstruktion bis 18° DN - konventionell- Holz in eigener Pos.', 'm2', 'Dachkonstruktion', 'POS-0014', 'POS-0014', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0014' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Abbund', 'h',
        0.3566, 55.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0014' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Aufstellen 0,18*55+2+0,05*55', 'h',
        0.18, 55.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0014' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Verladen', 'h',
        0.05, 55.0, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0014' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Befestigungsmaterial', 'h',
        2.0, 1.0, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Pultdachkonstruktion über 18° DN - konventionell- Holz in eigener Pos.', 'Pultdachkonstruktion über 18° DN - konventionell- Holz in eigener Pos.', 'Pultdachkonstruktion über 18° DN - konventionell- Holz in eigener Pos.', 'm2', 'Dachkonstruktion', 'POS-0015', 'POS-0015', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0015' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Abbund', 'h',
        0.3566, 55.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0015' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Aufstellen 0,2*55+2+0,05*55', 'h',
        0.2, 55.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0015' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Verladen', 'h',
        0.05, 55.0, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0015' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Befestigungsmaterial', 'h',
        2.0, 1.0, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Walmdachkonstruktion konvetionell - Holz in eigener Pos.', 'Walmdachkonstruktion konvetionell - Holz in eigener Pos.', 'Walmdachkonstruktion konvetionell - Holz in eigener Pos.', 'm2', 'Dachkonstruktion', 'POS-0016', 'POS-0016', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0016' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Abbund', 'h',
        0.5911, 55.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0016' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Aufstellen 0,2*55+2+0,05*55', 'h',
        0.28, 55.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0016' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Verladen', 'h',
        0.05, 55.0, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0016' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Befestigungsmaterial', 'h',
        2.0, 1.0, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Az Gaupe Konstruktion', 'Az Gaupe Konstruktion', 'Az Gaupe Konstruktion', 'Pa', 'Dachkonstruktion', 'POS-0017', 'POS-0017', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Windverankerung', 'Windverankerung', 'Windverankerung', 'Stk.', 'Dachkonstruktion', 'POS-0018', 'POS-0018', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0018' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        1.5, 65.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0018' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Gewindestangen Muttern Schlaganker', '',
        1, 11.59, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0018' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Muttern', '',
        1, 3.58, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0018' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Schlaganker', '',
        1, 17.92, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Lohnabbund maschinell zuzügl. Werksatzplanung-Holz in sepp. Pos', 'Lohnabbund maschinell zuzügl. Werksatzplanung-Holz in sepp. Pos', 'Lohnabbund maschinell zuzügl. Werksatzplanung-Holz in sepp. Pos', 'm3', 'Dachkonstruktion', 'POS-0019', 'POS-0019', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0019' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Abbund', 'h',
        3.0, 65.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0019' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Kleinmaterial', '',
        1, 25.0, 0, 0, 1);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Lohnabbund händisch zuzüglich Werksatzplanung-Holz sepp.Pos', 'Lohnabbund händisch zuzüglich Werksatzplanung-Holz sepp.Pos', 'Lohnabbund händisch zuzüglich Werksatzplanung-Holz sepp.Pos', 'm3', 'Dachkonstruktion', 'POS-0020', 'POS-0020', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0020' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Abbund', 'h',
        4.3, 65.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0020' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Kleinmaterial', '',
        1, 25.0, 0, 0, 1);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Holzsäulen BSH Fichte ohne Stützfüße mit Windauszug', 'Holzsäulen BSH Fichte ohne Stützfüße mit Windauszug', 'Holzsäulen BSH Fichte ohne Stützfüße mit Windauszug', 'Stk.', 'Dachkonstruktion', 'POS-0021', 'POS-0021', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0021' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        1.3, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0021' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Konstruktionsholz BSH Fi sicht', '',
        1, 64.3, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0021' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 33.6, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Holzsäulen BSH Fichte sicht Gl24h inkl. Stützenfuß inkl. Windauszug', 'Holzsäulen BSH Fichte sicht Gl24h inkl. Stützenfuß inkl. Windauszug', 'Holzsäulen BSH Fichte sicht Gl24h inkl. Stützenfuß inkl. Windauszug', 'Stk.', 'Dachkonstruktion', 'POS-0022', 'POS-0022', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0022' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        1.5, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0022' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Konstruktionsholz BSH Fi sicht', '',
        1, 64.3, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0022' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 84.0, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Strebe an Säule', 'Strebe an Säule', 'Strebe an Säule', 'Stk', 'Dachkonstruktion', 'POS-0023', 'POS-0023', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0023' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.3, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0023' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Konstruktionsholz BSH Fi sicht', '',
        1, 32.15, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0023' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 16.8, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Unterfangung Firstpfette', 'Unterfangung Firstpfette', 'Unterfangung Firstpfette', 'Stk.', 'Dachkonstruktion', 'POS-0024', 'POS-0024', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Sichtschalung 24mm n+f natur', 'Sichtschalung 24mm n+f natur', 'Sichtschalung 24mm n+f natur', 'm2', 'Dachaufbau', 'POS-0025', 'POS-0025', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0025' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Pauschale lt. Excel-Kalkulation', '',
        1, 28.61, 0, 0, 0);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, '3mm Bit.Dachbahn nsk', '3mm Bit.Dachbahn nsk', '3mm Bit.Dachbahn nsk', 'm2', 'Dachaufbau', 'POS-0026', 'POS-0026', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0026' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.1, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0026' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Bitumenbahn 3mm nsk', '',
        1, 9.66, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0026' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale Coilnägel Dachpappe+Gas', '',
        1, 1.12, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Bauder Pir Plus 20cm', 'Bauder Pir Plus 20cm', 'Bauder Pir Plus 20cm', 'm2', 'Dachaufbau', 'POS-0027', 'POS-0027', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0027' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.2, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0027' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Bauder Pir Plus 20cm', '',
        1, 74.7, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0027' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale Bauder PMK Band', '',
        1, 1.12, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Bauder Pir Plus 16cm', 'Bauder Pir Plus 16cm', 'Bauder Pir Plus 16cm', 'm2', 'Dachaufbau', 'POS-0028', 'POS-0028', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0028' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.2, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0028' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Bauder Pir Plus 20cm', '',
        1, 66.98, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0028' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale Bauder PMK Band', '',
        1, 1.12, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Ausgleichslattung 20cm', 'Ausgleichslattung 20cm', 'Ausgleichslattung 20cm', 'm2', 'Dachaufbau', 'POS-0029', 'POS-0029', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0029' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Pauschale lt. Excel-Kalkulation', '',
        1, 20.04, 0, 0, 0);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Ausgleichslattung 16cm', 'Ausgleichslattung 16cm', 'Ausgleichslattung 16cm', 'm2', 'Dachaufbau', 'POS-0030', 'POS-0030', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0030' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.15, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0030' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Rahmenholz 6x16cm', '',
        1, 8.57, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0030' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale Schrauben 8x260', '',
        1, 1.12, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Konterlattung 6x8cm', 'Konterlattung 6x8cm', 'Konterlattung 6x8cm', 'm2', 'Dachaufbau', 'POS-0031', 'POS-0031', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0031' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.12, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0031' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Konterlattung 6x8cm', '',
        1, 3.23, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0031' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale Schrauben 6x140', '',
        1, 0.9, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Dachlattung 4x5cm', 'Dachlattung 4x5cm', 'Dachlattung 4x5cm', 'm2', 'Dachaufbau', 'POS-0032', 'POS-0032', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0032' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.15, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0032' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Dachlattung 4x5cm', '',
        1, 2.92, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0032' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale Schrauben 6x140', '',
        1, 0.9, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Rauschalung 24mm', 'Rauschalung 24mm', 'Rauschalung 24mm', 'm2', 'Dachaufbau', 'POS-0033', 'POS-0033', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0033' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.19, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0033' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Rauschalung 24mm', '',
        1, 9.98, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0033' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale Coilnägel 5x70', '',
        1, 0.9, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Noteindeckung 1,5mm nsk', 'Noteindeckung 1,5mm nsk', 'Noteindeckung 1,5mm nsk', 'm2', 'Dachaufbau', 'POS-0034', 'POS-0034', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0034' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.1, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0034' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Bitumenbahn 1,5mm nsk', '',
        1, 4.69, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0034' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale Coilnägel Dachpappe+Gas', '',
        1, 1.12, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Flämmkeil h bis 5cm', 'Flämmkeil h bis 5cm', 'Flämmkeil h bis 5cm', 'm', 'Dachaufbau', 'POS-0035', 'POS-0035', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0035' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.1, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0035' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.1, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0035' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Konterlattung 6x8cm', '',
        1, 2.1, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0035' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale Schrauben 6x140', '',
        1, 0.34, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Anschlagsbrett für Aufdachdämmung', 'Anschlagsbrett für Aufdachdämmung', 'Anschlagsbrett für Aufdachdämmung', 'm', 'Dachaufbau', 'POS-0036', 'POS-0036', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0036' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.15, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0036' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Rauschalung 24mm', '',
        1, 1.6, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0036' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale Coilnägel 5x70', '',
        1, 0.45, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Spatzenbrett doppelt gedämmt H bis 25cm', 'Spatzenbrett doppelt gedämmt H bis 25cm', 'Spatzenbrett doppelt gedämmt H bis 25cm', 'm', 'Dachaufbau', 'POS-0037', 'POS-0037', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0037' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.1, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0037' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.07, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0037' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Dreischichtplatte 19mm B/C-Qualität 2x', '',
        1, 9.66, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0037' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Mineralwolle 16cm lambda 0,033', '',
        1, 3.92, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'First Baudertec PMK', 'First Baudertec PMK', 'First Baudertec PMK', 'm', 'Dachaufbau', 'POS-0038', 'POS-0038', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0038' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.1, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0038' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Bauder PMK Band', '',
        1, 10.19, 0, 0, 1);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Vordachtrennung', 'Vordachtrennung', 'Vordachtrennung', 'm', 'Dachaufbau', 'POS-0039', 'POS-0039', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0039' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.5, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0039' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Airstop VAP Dampfbremse', '',
        1, 1.14, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0039' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Klebepaste Quilli', '',
        1, 10.08, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0039' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Klebeband KB', '',
        1, 1.5, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Traufbrett Fichte geh. Natur b bis 25cm', 'Traufbrett Fichte geh. Natur b bis 25cm', 'Traufbrett Fichte geh. Natur b bis 25cm', 'm', 'Dachaufbau', 'POS-0040', 'POS-0040', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0040' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.2, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0040' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Glattkantbrett Fichte gehobelt, gefast, natur 23x200mm', '',
        1, 5.82, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0040' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungsmaterial', '',
        1, 0.5, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Lochblech alu antrazith b bis 15cm', 'Lochblech alu antrazith b bis 15cm', 'Lochblech alu antrazith b bis 15cm', 'm', 'Dachaufbau', 'POS-0041', 'POS-0041', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0041' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.11, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0041' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Lochgitter Prefa P10 antrazith bis 15cm 1x gekantet', '',
        1, 3.93, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0041' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungsmaterial', '',
        1, 0.25, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Traufblech alu antrazith b bis 15cm', 'Traufblech alu antrazith b bis 15cm', 'Traufblech alu antrazith b bis 15cm', 'm', 'Dachaufbau', 'POS-0042', 'POS-0042', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0042' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.11, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0042' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Lochgitter Prefa P10 antrazith bis 15cm 1x gekantet', '',
        1, 4.8, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0042' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungsmaterial', '',
        1, 0.25, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Windladen 3-S 19mm bis 25cm =b', 'Windladen 3-S 19mm bis 25cm =b', 'Windladen 3-S 19mm bis 25cm =b', 'm', 'Dachaufbau', 'POS-0043', 'POS-0043', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0043' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.3, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0043' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.06, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0043' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Dreischichtplatte 19mm B/C-Qualität', '',
        1, 4.83, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0043' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Dachlatten Fichte sägerau 4x5cm', '',
        1, 0.88, 0, 0, 3);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0043' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 1.12, 0, 0, 4);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Windladen 3-S 19mm bis 50cm =b', 'Windladen 3-S 19mm bis 50cm =b', 'Windladen 3-S 19mm bis 50cm =b', 'm', 'Dachaufbau', 'POS-0044', 'POS-0044', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0044' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.44, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0044' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.06, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0044' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Dreischichtplatte 19mm B/C-Qualität', '',
        1, 9.66, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0044' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Dachlatten Fichte sägerau 4x5cm', '',
        1, 0.88, 0, 0, 3);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0044' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 1.12, 0, 0, 4);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Dachdurchführung gedämmt mit einem Kasten bis 50x50x100cm', 'Dachdurchführung gedämmt mit einem Kasten bis 50x50x100cm', 'Dachdurchführung gedämmt mit einem Kasten bis 50x50x100cm', 'Stk.', 'Dachaufbau', 'POS-0045', 'POS-0045', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0045' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        6.0, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0045' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Material OSB', '',
        1, 16.74, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0045' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Material OSB', '',
        1, 16.74, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0045' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Material Steinwolle 8cm', '',
        1, 3.09, 0, 0, 3);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0045' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungsmat', '',
        1, 100.0, 0, 0, 4);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Pultdachentlüftung inkl.Lochg H  20cm', 'Pultdachentlüftung inkl.Lochg H  20cm', 'Pultdachentlüftung inkl.Lochg H  20cm', 'm', 'Dachaufbau', 'POS-0046', 'POS-0046', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0046' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.22, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0046' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.1, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0046' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Dreischichtplatte 19mm D/D', '',
        1, 6.81, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0046' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Lochgitter', '',
        1, 4.25, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Firstentlüft.satteldachf.inkl Lochg', 'Firstentlüft.satteldachf.inkl Lochg', 'Firstentlüft.satteldachf.inkl Lochg', 'm', 'Dachaufbau', 'POS-0047', 'POS-0047', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0047' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.28, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0047' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.1, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0047' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Dreischichtplatte 19mm D/D', '',
        1, 9.09, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0047' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Lochgitter', '',
        1, 8.5, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Holzfaserdämmplatte auf Spatzenbrett', 'Holzfaserdämmplatte auf Spatzenbrett', 'Holzfaserdämmplatte auf Spatzenbrett', 'm', 'Dachaufbau', 'POS-0048', 'POS-0048', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0048' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.1, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0048' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.05, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0048' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Holzfaserdämmplatte 6cm', '',
        1, 4.0, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Spatzenbrett einfach H bis 25cm', 'Spatzenbrett einfach H bis 25cm', 'Spatzenbrett einfach H bis 25cm', 'm', 'Dachaufbau', 'POS-0049', 'POS-0049', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0049' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.08, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0049' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.05, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0049' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Dreischichtplatte 19mm D/D', '',
        1, 5.68, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Riegelwandkonstruktion 16cm gedämmt - Mineralw.', 'Riegelwandkonstruktion 16cm gedämmt - Mineralw.', 'Riegelwandkonstruktion 16cm gedämmt - Mineralw.', 'm2', 'Außenwände gedämmt', 'POS-0050', 'POS-0050', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0050' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        1.4, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0050' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.1, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0050' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'OSB-Platte 15mm N+F', '',
        1, 8.37, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0050' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Rahmenholz 6x16cm', '',
        1, 10.9, 0, 0, 3);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0050' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Mineralwolle 16cm lambda 0,033', '',
        1, 16.23, 0, 0, 4);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0050' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Holzfaserplatte 6cm verputzbar 150kg/m3', '',
        1, 14.17, 0, 0, 5);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0050' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 6.44, 0, 0, 6);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Riegelwandkonstruktion 16cm gedämmt - Zellulose', 'Riegelwandkonstruktion 16cm gedämmt - Zellulose', 'Riegelwandkonstruktion 16cm gedämmt - Zellulose', 'm2', 'Außenwände gedämmt', 'POS-0051', 'POS-0051', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0051' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        1.2, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0051' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.1, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0051' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'OSB-Platte 15mm N+F', '',
        1, 8.37, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0051' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Rahmenholz 6x16cm', '',
        1, 10.9, 0, 0, 3);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0051' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Zellulose', '',
        1, 28.0, 0, 0, 4);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0051' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Holzfaserplatte 6cm verputzbar 150kg/m3', '',
        1, 14.17, 0, 0, 5);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0051' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 6.44, 0, 0, 6);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Statische Verstärkungen in Riegelwände', 'Statische Verstärkungen in Riegelwände', 'Statische Verstärkungen in Riegelwände', 'm3', 'Außenwände gedämmt', 'POS-0052', 'POS-0052', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0052' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.3, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0052' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.3, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0052' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Konstruktionsholz BSH Fi sicht Gl24h-Lagerware', '',
        1, 837.2, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0052' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale Schrauben', '',
        1, 5.6, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Dampfdichte Verklebung der Anschlüsse und Wände', 'Dampfdichte Verklebung der Anschlüsse und Wände', 'Dampfdichte Verklebung der Anschlüsse und Wände', 'm2', 'Außenwände gedämmt', 'POS-0053', 'POS-0053', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0053' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.2, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0053' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Klebeband KB Airstop', '',
        1, 1.46, 0, 0, 1);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Öffnung in Riegelwände herstellen', 'Öffnung in Riegelwände herstellen', 'Öffnung in Riegelwände herstellen', 'm2', 'Außenwände gedämmt', 'POS-0054', 'POS-0054', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0054' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.4, 54.0, 0, 0, 0);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Montageschwelle', 'Montageschwelle', 'Montageschwelle', 'm', 'Außenwände gedämmt', 'POS-0055', 'POS-0055', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0055' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.55, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0055' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Quellmörtel', '',
        1, 0.7, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0055' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Rahmenholz 6x16cm', '',
        1, 22.49, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0055' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungsmaterial Schlaganker 16x240', '',
        1, 1.46, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Elektroleitungen verlegen im Sockelbereich', 'Elektroleitungen verlegen im Sockelbereich', 'Elektroleitungen verlegen im Sockelbereich', 'Pa', 'Außenwände gedämmt', 'POS-0056', 'POS-0056', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Montagearbeiten inkl. Ral-Verklebung u. Befest.material', 'Montagearbeiten inkl. Ral-Verklebung u. Befest.material', 'Montagearbeiten inkl. Ral-Verklebung u. Befest.material', 'm', 'Fenster', 'POS-0057', 'POS-0057', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0057' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.6, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0057' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Fensterband Window innen', '',
        1, 4.37, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0057' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Fensterband Window innen', '',
        1, 4.37, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0057' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Weichzellschaum', '',
        1, 1.89, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Regiearbeiten Schremmarbeiten, anpassen Fenster', 'Regiearbeiten Schremmarbeiten, anpassen Fenster', 'Regiearbeiten Schremmarbeiten, anpassen Fenster', 'Std', 'Fenster', 'POS-0058', 'POS-0058', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Fenster Lieferkosten', 'Fenster Lieferkosten', 'Fenster Lieferkosten', 'Pa', 'Fenster', 'POS-0059', 'POS-0059', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Innenwände ungedämmt 12cm eins. Beplankt 1xGKB-Pl.12,5mm', 'Innenwände ungedämmt 12cm eins. Beplankt 1xGKB-Pl.12,5mm', 'Innenwände ungedämmt 12cm eins. Beplankt 1xGKB-Pl.12,5mm', 'm2', 'Innenwände', 'POS-0060', 'POS-0060', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0060' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.8, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0060' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.1, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0060' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'GKB-Platte 12,5mm', '',
        1, 4.51, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0060' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Rahmenholz 6x12cm', '',
        1, 8.18, 0, 0, 3);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0060' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 5.8, 0, 0, 4);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Innenwände undämmt 16cm eins. Beplankt 1xGKB-Pl.12,5mm', 'Innenwände undämmt 16cm eins. Beplankt 1xGKB-Pl.12,5mm', 'Innenwände undämmt 16cm eins. Beplankt 1xGKB-Pl.12,5mm', 'm2', 'Innenwände', 'POS-0061', 'POS-0061', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0061' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.8, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0061' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.1, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0061' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'GKB-Platte 12,5mm', '',
        1, 4.51, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0061' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Rahmenholz 6x16cm', '',
        1, 10.9, 0, 0, 3);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0061' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 5.8, 0, 0, 4);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Innenwände gedämmt 16cm geschlossen beidseitig 1xOSB -Platte 15mm N+F', 'Innenwände gedämmt 16cm geschlossen beidseitig 1xOSB -Platte 15mm N+F', 'Innenwände gedämmt 16cm geschlossen beidseitig 1xOSB -Platte 15mm N+F', 'm2', 'Innenwände', 'POS-0062', 'POS-0062', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0062' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        1.2, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0062' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.1, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0062' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'OSB-Platte 15mm N+F 2x', '',
        1, 16.74, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0062' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Rahmenholz 6x16cm', '',
        1, 10.9, 0, 0, 3);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0062' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 5.8, 0, 0, 4);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Windpapier verklebt - UV beständig', 'Windpapier verklebt - UV beständig', 'Windpapier verklebt - UV beständig', 'm2', 'Fassade', 'POS-0063', 'POS-0063', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0063' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.1, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0063' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Winddichtung G20 UV-beständig', '',
        1, 9.07, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0063' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale Klebeband', '',
        1, 2.24, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Hinterlüftungslattung 5x3cm', 'Hinterlüftungslattung 5x3cm', 'Hinterlüftungslattung 5x3cm', 'm2', 'Fassade', 'POS-0064', 'POS-0064', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0064' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.2, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0064' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Dachlattung 4x5cm', '',
        1, 1.19, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0064' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale Schrauben 5x100', '',
        1, 0.9, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Hinterlüftungslattung 5x3cm gedübelt', 'Hinterlüftungslattung 5x3cm gedübelt', 'Hinterlüftungslattung 5x3cm gedübelt', 'm2', 'Fassade', 'POS-0065', 'POS-0065', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0065' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.3, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0065' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Dachlattung 4x5cm', '',
        1, 1.19, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0065' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 2.24, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Fassadenschalung - Stulpschalung Lärche', 'Fassadenschalung - Stulpschalung Lärche', 'Fassadenschalung - Stulpschalung Lärche', 'm2', 'Fassade', 'POS-0066', 'POS-0066', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0066' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        1.2, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0066' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Stulpschalung Lärche gehobelt', '',
        1, 45.08, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0066' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 0.45, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Stulpschalung Fichte natur gehobelt', 'Stulpschalung Fichte natur gehobelt', 'Stulpschalung Fichte natur gehobelt', 'm2', 'Fassade', 'POS-0067', 'POS-0067', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0067' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        1.2, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0067' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Stulpschalung Fichte gehobelt', '',
        1, 36.06, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0067' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 0.45, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Fassadenschalung Fichte natur gehobelt n+f', 'Fassadenschalung Fichte natur gehobelt n+f', 'Fassadenschalung Fichte natur gehobelt n+f', 'm2', 'Fassade', 'POS-0068', 'POS-0068', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0068' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        1.2, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0068' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Fassadenschalung Fichte natur gehobelt n+f', '',
        1, 17.9, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0068' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 0.45, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Scheinung in Lärche gehobelt herstellen b bis 24cm', 'Scheinung in Lärche gehobelt herstellen b bis 24cm', 'Scheinung in Lärche gehobelt herstellen b bis 24cm', 'm', 'Fassade', 'POS-0069', 'POS-0069', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0069' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.8, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0069' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Glattkantbrett Lärche natur gehobelt n+f b bis 25cm 2,3cm', '',
        1, 8.96, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0069' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 1.12, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Kemperol abdichtung', 'Kemperol abdichtung', 'Kemperol abdichtung', 'm2', 'Fassade', 'POS-0070', 'POS-0070', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0070' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Pauschale', '',
        1, 26.43, 0, 0, 0);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Wetterschenkel  Lärche bis 24cm 4cm stark', 'Wetterschenkel  Lärche bis 24cm 4cm stark', 'Wetterschenkel  Lärche bis 24cm 4cm stark', 'm', 'Fassade', 'POS-0071', 'POS-0071', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0071' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.9, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0071' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Glattkantbrett Lärche natur gehobelt n+f b bis 24cm 4cm', '',
        1, 14.4, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0071' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 1.12, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Lochgitter bis 15cm', 'Lochgitter bis 15cm', 'Lochgitter bis 15cm', 'm', 'Fassade', 'POS-0072', 'POS-0072', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0072' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.1, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0072' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Lochgitter antrazith 5-7 Lochung', '',
        1, 4.25, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0072' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 0.22, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Dachziegel Creaton MZ3 Tondachziegel, naturrot', 'Dachziegel Creaton MZ3 Tondachziegel, naturrot', 'Dachziegel Creaton MZ3 Tondachziegel, naturrot', 'Stk.', 'Dachdeckerarbeiten', 'POS-0073', 'POS-0073', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Ortgangziegel', 'Ortgangziegel', 'Ortgangziegel', 'Stk.', 'Dachdeckerarbeiten', 'POS-0074', 'POS-0074', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Firstziegel naturrot', 'Firstziegel naturrot', 'Firstziegel naturrot', 'Stk.', 'Dachdeckerarbeiten', 'POS-0075', 'POS-0075', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Firstklammer Alu rot', 'Firstklammer Alu rot', 'Firstklammer Alu rot', 'Stk.', 'Dachdeckerarbeiten', 'POS-0076', 'POS-0076', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Firstgratrolle a5 lfm', 'Firstgratrolle a5 lfm', 'Firstgratrolle a5 lfm', 'Rol', 'Dachdeckerarbeiten', 'POS-0077', 'POS-0077', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Creaton Lüfterziegel naturrot', 'Creaton Lüfterziegel naturrot', 'Creaton Lüfterziegel naturrot', 'Stk.', 'Dachdeckerarbeiten', 'POS-0078', 'POS-0078', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Schneenase rot  250/Pak', 'Schneenase rot  250/Pak', 'Schneenase rot  250/Pak', 'Stk.', 'Dachdeckerarbeiten', 'POS-0079', 'POS-0079', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Einhängesturmklammern  250/Pak', 'Einhängesturmklammern  250/Pak', 'Einhängesturmklammern  250/Pak', 'Stk.', 'Dachdeckerarbeiten', 'POS-0080', 'POS-0080', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Firstgratlattenhalter 10Stk/Pak', 'Firstgratlattenhalter 10Stk/Pak', 'Firstgratlattenhalter 10Stk/Pak', 'Stk.', 'Dachdeckerarbeiten', 'POS-0081', 'POS-0081', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Kommissionierung', 'Kommissionierung', 'Kommissionierung', 'Pa', 'Dachdeckerarbeiten', 'POS-0082', 'POS-0082', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Frachtkostenbeitrag', 'Frachtkostenbeitrag', 'Frachtkostenbeitrag', 'Pa', 'Dachdeckerarbeiten', 'POS-0083', 'POS-0083', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Kran je Hub', 'Kran je Hub', 'Kran je Hub', 'Pa', 'Dachdeckerarbeiten', 'POS-0084', 'POS-0084', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Verlegearbeit', 'Verlegearbeit', 'Verlegearbeit', 'Std', 'Dachdeckerarbeiten', 'POS-0085', 'POS-0085', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Paletten Abnützung', 'Paletten Abnützung', 'Paletten Abnützung', 'Stk.', 'Dachdeckerarbeiten', 'POS-0086', 'POS-0086', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Windladenverblendung bis 25cm einteilig', 'Windladenverblendung bis 25cm einteilig', 'Windladenverblendung bis 25cm einteilig', 'm', 'Spenglerarbeiten', 'POS-0087', 'POS-0087', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Windladenabdeckung bis 12cm', 'Windladenabdeckung bis 12cm', 'Windladenabdeckung bis 12cm', 'm', 'Spenglerarbeiten', 'POS-0088', 'POS-0088', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Windladenablaufschiene  bis 25cm', 'Windladenablaufschiene  bis 25cm', 'Windladenablaufschiene  bis 25cm', 'm', 'Spenglerarbeiten', 'POS-0089', 'POS-0089', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Hängerinne 33er rund', 'Hängerinne 33er rund', 'Hängerinne 33er rund', 'm', 'Spenglerarbeiten', 'POS-0090', 'POS-0090', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Rinneneinlaufblech bis 33cm', 'Rinneneinlaufblech bis 33cm', 'Rinneneinlaufblech bis 33cm', 'm', 'Spenglerarbeiten', 'POS-0091', 'POS-0091', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Bögen - Rohrknie 72° 100mm', 'Bögen - Rohrknie 72° 100mm', 'Bögen - Rohrknie 72° 100mm', 'Stk', 'Spenglerarbeiten', 'POS-0092', 'POS-0092', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Abschlüsse - Rinnenboden rund 33er', 'Abschlüsse - Rinnenboden rund 33er', 'Abschlüsse - Rinnenboden rund 33er', 'Stk', 'Spenglerarbeiten', 'POS-0093', 'POS-0093', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Rinnenkessel - StandardEinhang rund 33/100', 'Rinnenkessel - StandardEinhang rund 33/100', 'Rinnenkessel - StandardEinhang rund 33/100', 'Stk', 'Spenglerarbeiten', 'POS-0094', 'POS-0094', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Ablaufrohr 100er', 'Ablaufrohr 100er', 'Ablaufrohr 100er', 'm', 'Spenglerarbeiten', 'POS-0095', 'POS-0095', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Fensterbleche bis 33cm', 'Fensterbleche bis 33cm', 'Fensterbleche bis 33cm', 'm', 'Spenglerarbeiten', 'POS-0096', 'POS-0096', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Kamineinfassung', 'Kamineinfassung', 'Kamineinfassung', 'Stk', 'Spenglerarbeiten', 'POS-0097', 'POS-0097', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Kamin -Mantel', 'Kamin -Mantel', 'Kamin -Mantel', 'Stk', 'Spenglerarbeiten', 'POS-0098', 'POS-0098', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Flämmarbeit Garagendach 1xEKV4und 1xEKV5s', 'Flämmarbeit Garagendach 1xEKV4und 1xEKV5s', 'Flämmarbeit Garagendach 1xEKV4und 1xEKV5s', 'm2', 'Spenglerarbeiten', 'POS-0099', 'POS-0099', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0099' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.45, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0099' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Bitumenbahn 4mm EKV-4K', '',
        1, 9.83, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0099' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Bitumenbahn 5mm EKV-5S', '',
        1, 28.22, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0099' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 4.0, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Flämmarbeit Terrasse einfach', 'Flämmarbeit Terrasse einfach', 'Flämmarbeit Terrasse einfach', 'm2', 'Spenglerarbeiten', 'POS-0100', 'POS-0100', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0100' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.35, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0100' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Bitumenbahn 4mm EKV-4K', '',
        1, 9.83, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0100' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 3.0, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Einlaufblech Uginox', 'Einlaufblech Uginox', 'Einlaufblech Uginox', 'm', 'Spenglerarbeiten', 'POS-0101', 'POS-0101', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Tramdecke 24cm gedämmt  MW 0,033- Holz in sepp. Pos.', 'Tramdecke 24cm gedämmt  MW 0,033- Holz in sepp. Pos.', 'Tramdecke 24cm gedämmt  MW 0,033- Holz in sepp. Pos.', 'm2', 'Decke', 'POS-0102', 'POS-0102', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0102' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        1.32, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0102' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Mineralwolle Trennwandfilz 20cm lambda 0,033 120cm', '',
        1, 14.76, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0102' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'OSB-Platte 15mm N+F ungeschl.', '',
        1, 8.37, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0102' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'OSB-Platte 18mm N+F ungeschl.', '',
        1, 10.05, 0, 0, 3);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0102' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungsmat', '',
        1, 5.0, 0, 0, 4);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Deckeneinschlag Ausführung diffussionsoffen', 'Deckeneinschlag Ausführung diffussionsoffen', 'Deckeneinschlag Ausführung diffussionsoffen', 'm', 'Decke', 'POS-0103', 'POS-0103', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0103' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.12, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0103' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Diffussionsoffene Dachbahn', '',
        1, 1.29, 0, 0, 1);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Falzbretter 19mm', 'Falzbretter 19mm', 'Falzbretter 19mm', 'm', 'Decke', 'POS-0104', 'POS-0104', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0104' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.1, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0104' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Maschinenstunde', 'h',
        0.1, 75.0, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0104' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Dreischichtplatte Fichte 19mm D/D Qualität', '',
        1, 4.83, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0104' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 2.0, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Massivholzdecke BSH 14cm sicht-Falzbretter sepp.Pos.', 'Massivholzdecke BSH 14cm sicht-Falzbretter sepp.Pos.', 'Massivholzdecke BSH 14cm sicht-Falzbretter sepp.Pos.', 'm2', 'Decke', 'POS-0105', 'POS-0105', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0105' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.28, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0105' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'BSH Deckenelement sicht 14cm', '',
        1, 110.9, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0105' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 10.0, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Massivholzdecke BSH 16cm sicht-Falzbretter sepp.Pos.', 'Massivholzdecke BSH 16cm sicht-Falzbretter sepp.Pos.', 'Massivholzdecke BSH 16cm sicht-Falzbretter sepp.Pos.', 'm2', 'Decke', 'POS-0106', 'POS-0106', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0106' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.29, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0106' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'BSH Deckenelement sicht 14cm', '',
        1, 126.74, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0106' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 10.0, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Massivholzdecke BSH 14cm nicht sicht-Falzbretter sepp.Pos.', 'Massivholzdecke BSH 14cm nicht sicht-Falzbretter sepp.Pos.', 'Massivholzdecke BSH 14cm nicht sicht-Falzbretter sepp.Pos.', 'm2', 'Decke', 'POS-0107', 'POS-0107', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0107' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.28, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0107' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'BSH Deckenelement sicht 14cm', '',
        1, 109.09, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0107' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 10.0, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Massivholzdecke BSH 16cm nicht sicht-Falzbretter sepp.Pos.', 'Massivholzdecke BSH 16cm nicht sicht-Falzbretter sepp.Pos.', 'Massivholzdecke BSH 16cm nicht sicht-Falzbretter sepp.Pos.', 'm2', 'Decke', 'POS-0108', 'POS-0108', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0108' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.29, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0108' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'BSH Deckenelement sicht 14cm', '',
        1, 124.68, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0108' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 10.0, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Massivholzdecke CLT 14cm nicht sicht-Falzbretter sepp.Pos.', 'Massivholzdecke CLT 14cm nicht sicht-Falzbretter sepp.Pos.', 'Massivholzdecke CLT 14cm nicht sicht-Falzbretter sepp.Pos.', 'm2', 'Decke', 'POS-0109', 'POS-0109', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0109' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.3, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0109' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'BSH Deckenelement sicht 14cm', '',
        1, 124.68, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0109' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 20.0, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Massivholzdecke CLT 14cm sicht-Falzbretter sepp.Pos.', 'Massivholzdecke CLT 14cm sicht-Falzbretter sepp.Pos.', 'Massivholzdecke CLT 14cm sicht-Falzbretter sepp.Pos.', 'm2', 'Decke', 'POS-0110', 'POS-0110', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0110' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.3, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0110' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'BSH Deckenelement sicht 14cm', '',
        1, 124.68, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0110' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 20.0, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Balkonboden Lä. geh. 23mm inkl. Unterkonstruktion 6x8cm', 'Balkonboden Lä. geh. 23mm inkl. Unterkonstruktion 6x8cm', 'Balkonboden Lä. geh. 23mm inkl. Unterkonstruktion 6x8cm', 'm2', 'Balkonboden', 'POS-0111', 'POS-0111', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0111' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        1.2, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0111' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Terrassenrost Lärche glatt gehobelt', '',
        1, 32.2, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0111' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Lattten Lärche 6x8cm', '',
        1, 8.56, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0111' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 5.0, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Balkonboden Lä. geh. 23mm ohne UK', 'Balkonboden Lä. geh. 23mm ohne UK', 'Balkonboden Lä. geh. 23mm ohne UK', 'm2', 'Balkonboden', 'POS-0112', 'POS-0112', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0112' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.75, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0112' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Terrassenrost Lärche glatt gehobelt', '',
        1, 32.2, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0112' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 3.0, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Streicher  Lärche gehobelt12x12cm', 'Streicher  Lärche gehobelt12x12cm', 'Streicher  Lärche gehobelt12x12cm', 'm2', 'Balkonboden', 'POS-0113', 'POS-0113', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0113' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.35, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0113' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Lärchen Bauholz sägerau ca.15-20%', '',
        1, 28.66, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0113' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 2.0, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Sticher -Balkon-Stahlzugeisen inkl. Holz  max 1m', 'Sticher -Balkon-Stahlzugeisen inkl. Holz  max 1m', 'Sticher -Balkon-Stahlzugeisen inkl. Holz  max 1m', 'Stk', 'Balkonboden', 'POS-0114', 'POS-0114', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Balkon- Stahlträger  doppelt für Ablastung Pfette', 'Balkon- Stahlträger  doppelt für Ablastung Pfette', 'Balkon- Stahlträger  doppelt für Ablastung Pfette', 'Stk', 'Balkonboden', 'POS-0115', 'POS-0115', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, '3-S Platte 27mm Fichte Qualität B/C natur', '3-S Platte 27mm Fichte Qualität B/C natur', '3-S Platte 27mm Fichte Qualität B/C natur', 'm2', 'Balkonboden', 'POS-0116', 'POS-0116', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0116' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.25, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0116' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Dreischichtplatte 27mm', '',
        1, 28.34, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0116' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 1.0, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Bodenbelag - Sichtschalung 25mm n+f', 'Bodenbelag - Sichtschalung 25mm n+f', 'Bodenbelag - Sichtschalung 25mm n+f', 'm2', 'Balkonboden', 'POS-0117', 'POS-0117', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0117' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.25, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0117' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Fasenschalung 25mm  n+f', '',
        1, 19.19, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0117' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 0.8, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Flämmarbeiten 1xEKV4', 'Flämmarbeiten 1xEKV4', 'Flämmarbeiten 1xEKV4', 'm2', 'Balkonboden', 'POS-0118', 'POS-0118', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0118' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.35, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0118' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Bitumenbahn 4mm EKV-4K', '',
        1, 9.83, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0118' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 3.0, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Tropfblech b bis 15cm', 'Tropfblech b bis 15cm', 'Tropfblech b bis 15cm', 'm', 'Balkonboden', 'POS-0119', 'POS-0119', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0119' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.1, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0119' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Bandblech prefa antrazith', '',
        1, 4.83, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0119' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 0.22, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Tropfblech Uginox b bis 15cm', 'Tropfblech Uginox b bis 15cm', 'Tropfblech Uginox b bis 15cm', 'm', 'Balkonboden', 'POS-0120', 'POS-0120', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0120' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        0.15, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0120' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Bandblech prefa antrazith', '',
        1, 5.8, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0120' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 3.36, 0, 0, 2);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Balkontrennwand', 'Balkontrennwand', 'Balkontrennwand', 'Stk', 'Balkonboden', 'POS-0121', 'POS-0121', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Balkonbrüstung', 'Balkonbrüstung', 'Balkonbrüstung', 'm', 'Balkonboden', 'POS-0122', 'POS-0122', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0122' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'montieren', '',
        1, 76.7, 0, 0, 0);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Terrassenrost mit Unterkonstr. 12x12cm', 'Terrassenrost mit Unterkonstr. 12x12cm', 'Terrassenrost mit Unterkonstr. 12x12cm', 'm2', 'Balkonboden', 'POS-0123', 'POS-0123', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0123' AND art='position' LIMIT 1),
        NULL, 'lohn', 'Facharbeiterstunde', 'h',
        1.25, 54.0, 0, 0, 0);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0123' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Terrassenrost Lärche glatt gehobelt', '',
        1, 32.2, 0, 0, 1);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0123' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Lattten Lärche 12x12cm', '',
        1, 25.68, 0, 0, 2);
INSERT INTO public.position_components
  (position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order)
VALUES ((SELECT id FROM public.invoice_templates WHERE produktnummer='POS-0123' AND art='position' LIMIT 1),
        NULL, 'sonstiges', 'Befestigungspauschale', '',
        1, 6.0, 0, 0, 3);
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Rankhilfe', 'Rankhilfe', 'Rankhilfe', 'm2', 'Balkonboden', 'POS-0124', 'POS-0124', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Pflanzkübel', 'Pflanzkübel', 'Pflanzkübel', 'Stk', 'Balkonboden', 'POS-0125', 'POS-0125', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Lamllenfassade', 'Lamllenfassade', 'Lamllenfassade', 'Stk', 'Balkonboden', 'POS-0126', 'POS-0126', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, 'Zaun in Lärche stehend gehobelt 5x4cm Latten', 'Zaun in Lärche stehend gehobelt 5x4cm Latten', 'Zaun in Lärche stehend gehobelt 5x4cm Latten', 'm', 'Zaun', 'POS-0127', 'POS-0127', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, '1Std/m', '1Std/m', '1Std/m', 'herrichten+elementieren', 'Arbeit', 'POS-0128', 'POS-0128', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, '0,64Std/m', '0,64Std/m', '0,64Std/m', 'montieren', 'Arbeit', 'POS-0129', 'POS-0129', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, '0,55Std/m', '0,55Std/m', '0,55Std/m', 'montieren Einsensteher', 'Arbeit', 'POS-0130', 'POS-0130', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, '0,45Std/m', '0,45Std/m', '0,45Std/m', 'Maschienenstunde', 'Arbeit', 'POS-0131', 'POS-0131', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;
INSERT INTO public.invoice_templates
  (user_id, name, kurzbezeichnung, beschreibung, einheit, kategorie, produktnummer, artikelnummer, art,
   ek_netto, vk_netto, netto_preis, einzelpreis, brutto_preis, ust_satz, ist_kalkuliert, ist_set)
SELECT user_id, '0,5Std/m', '0,5Std/m', '0,5Std/m', 'LKW liefern +verheben', 'Arbeit', 'POS-0132', 'POS-0132', 'position',
       0, 0, 0, 0, 0, 20, false, false
FROM public.user_roles WHERE role = 'administrator' LIMIT 1;