-- ============================================================================
-- Materialien & Positionen — Kalkulation nach Excel-Vorlage
-- "Z_Kalkulation Vorlage 2026 Material und Positionen.xlsx"
-- ----------------------------------------------------------------------------
-- Zwei-Ebenen-Modell:
--   MATERIALIEN  = flache Preisliste (Name, Einheit, EK) inkl. Stundensätze
--   POSITIONEN   = kalkulierte Leistungen, bestehend aus Komponenten:
--                  Material-Zeilen  (Menge/EH x EK x Verschnitt x Aufschlag)
--                  Lohn-Zeilen      (Std/EH x Stundensatz)
--                  Sonstiges-Zeilen (Betrag/EH)
--                  -> Summe = Einzelpreis (VK) der Position
-- Das bisherige "Set/Gruppen"-Konzept wird dadurch ersetzt.
-- ============================================================================

-- 1) Unterscheidung Material vs. Position im bestehenden Katalog
ALTER TABLE public.invoice_templates
  ADD COLUMN IF NOT EXISTS art text NOT NULL DEFAULT 'position';

ALTER TABLE public.invoice_templates
  DROP CONSTRAINT IF EXISTS invoice_templates_art_check;
ALTER TABLE public.invoice_templates
  ADD CONSTRAINT invoice_templates_art_check CHECK (art IN ('material', 'position'));

CREATE INDEX IF NOT EXISTS idx_invoice_templates_art ON public.invoice_templates(art);

-- 2) Komponenten einer Position
CREATE TABLE IF NOT EXISTS public.position_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_template_id uuid NOT NULL REFERENCES public.invoice_templates(id) ON DELETE CASCADE,
  -- Verknüpftes Material (NULL = freie Zeile). EK kommt dann LIVE aus dem
  -- Material — Preisänderungen wirken automatisch auf alle Positionen.
  material_template_id uuid REFERENCES public.invoice_templates(id) ON DELETE SET NULL,
  typ text NOT NULL DEFAULT 'material' CHECK (typ IN ('material', 'lohn', 'sonstiges')),
  bezeichnung text NOT NULL,
  einheit text NOT NULL DEFAULT '',
  -- material: Menge pro Einheit der Position (z.B. 0.025 m3/m2)
  -- lohn:     Stunden pro Einheit der Position (z.B. 0.2 h/m2)
  -- sonstiges: Menge (meist 1)
  menge_pro_einheit numeric NOT NULL DEFAULT 1,
  -- material (nur wenn material_template_id NULL): EK EUR/Einheit
  -- lohn: Stundensatz EUR/h  |  sonstiges: Betrag EUR
  preis numeric NOT NULL DEFAULT 0,
  verschnitt_prozent numeric NOT NULL DEFAULT 0,
  aufschlag_prozent numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_position_components_position ON public.position_components(position_template_id);
CREATE INDEX IF NOT EXISTS idx_position_components_material ON public.position_components(material_template_id);

ALTER TABLE public.position_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users can view position components" ON public.position_components;
CREATE POLICY "Active users can view position components"
  ON public.position_components FOR SELECT
  USING (is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Active users can manage position components" ON public.position_components;
CREATE POLICY "Active users can manage position components"
  ON public.position_components FOR ALL
  USING (is_active_user(auth.uid()))
  WITH CHECK (is_active_user(auth.uid()));

-- 3) Preis-Berechnung: VK einer Position aus ihren Komponenten
--    material: menge x EK(live oder preis) x (1+verschnitt%) x (1+aufschlag%)
--    lohn:     menge(Std) x preis(Satz)
--    sonstiges: menge x preis
CREATE OR REPLACE FUNCTION public.recompute_position_price(p_position_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vk numeric;
  v_minuten numeric;
  v_ust numeric;
BEGIN
  SELECT
    COALESCE(SUM(
      CASE c.typ
        WHEN 'material' THEN c.menge_pro_einheit
          * COALESCE(m.ek_netto, c.preis)
          * (1 + c.verschnitt_prozent / 100.0)
          * (1 + c.aufschlag_prozent / 100.0)
        WHEN 'lohn' THEN c.menge_pro_einheit * c.preis
        ELSE c.menge_pro_einheit * c.preis
      END
    ), 0),
    COALESCE(SUM(CASE WHEN c.typ = 'lohn' THEN c.menge_pro_einheit * 60 ELSE 0 END), 0)
  INTO v_vk, v_minuten
  FROM public.position_components c
  LEFT JOIN public.invoice_templates m ON m.id = c.material_template_id
  WHERE c.position_template_id = p_position_id;

  -- Nur anfassen, wenn die Position wirklich Komponenten hat
  IF NOT EXISTS (SELECT 1 FROM public.position_components WHERE position_template_id = p_position_id) THEN
    RETURN;
  END IF;

  v_vk := ROUND(v_vk, 2);

  SELECT COALESCE(ust_satz, 20) INTO v_ust FROM public.invoice_templates WHERE id = p_position_id;

  UPDATE public.invoice_templates
     SET vk_netto = v_vk,
         netto_preis = v_vk,
         einzelpreis = v_vk,
         brutto_preis = ROUND(v_vk * (1 + COALESCE(v_ust, 20) / 100.0), 2),
         -- Lohnminuten pro Einheit für den Stundenabgleich im Angebot
         arbeitszeit_minuten = ROUND(v_minuten, 1)
   WHERE id = p_position_id;
END;
$$;

-- Trigger: Komponenten geändert -> Position neu rechnen
CREATE OR REPLACE FUNCTION public.trg_component_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.recompute_position_price(COALESCE(NEW.position_template_id, OLD.position_template_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS position_components_recompute ON public.position_components;
CREATE TRIGGER position_components_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.position_components
  FOR EACH ROW EXECUTE FUNCTION public.trg_component_recompute();

-- Trigger: Material-EK geändert -> alle Positionen neu rechnen, die es nutzen
CREATE OR REPLACE FUNCTION public.trg_material_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pos RECORD;
BEGIN
  IF NEW.art = 'material' AND NEW.ek_netto IS DISTINCT FROM OLD.ek_netto THEN
    FOR pos IN
      SELECT DISTINCT position_template_id
        FROM public.position_components
       WHERE material_template_id = NEW.id
    LOOP
      PERFORM public.recompute_position_price(pos.position_template_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_templates_material_recompute ON public.invoice_templates;
CREATE TRIGGER invoice_templates_material_recompute
  AFTER UPDATE ON public.invoice_templates
  FOR EACH ROW EXECUTE FUNCTION public.trg_material_recompute();
