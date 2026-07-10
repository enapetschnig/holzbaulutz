-- =====================================================================
-- Bautagesberichte: Klon des Regiebericht-Moduls (disturbances)
-- Tabellen + RLS + Storage-Buckets + role_permissions-Seed
-- =====================================================================

-- Haupttabelle für Bautagesberichte
CREATE TABLE public.bautagesberichte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Einsatzdaten
  datum DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  pause_minutes INTEGER NOT NULL DEFAULT 0,
  stunden NUMERIC NOT NULL,

  -- Kundendaten (Snapshot zum Zeitpunkt der Erfassung)
  kunde_name TEXT NOT NULL,
  kunde_email TEXT,
  kunde_adresse TEXT,
  kunde_plz TEXT,
  kunde_ort TEXT,
  kunde_telefon TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,

  -- Projekt-Zuordnung
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

  -- Arbeitsdetails
  beschreibung TEXT NOT NULL,
  notizen TEXT,

  -- Status / Abrechnung / PDF
  status TEXT NOT NULL DEFAULT 'offen', -- offen | gesendet | abgeschlossen
  is_verrechnet BOOLEAN NOT NULL DEFAULT false,
  pdf_path TEXT,
  pdf_gesendet_am TIMESTAMPTZ,

  -- Kundenunterschrift
  unterschrift_kunde TEXT,
  unterschrift_am TIMESTAMPTZ
);

-- Mitarbeiter-Zuordnung (wie disturbance_workers)
CREATE TABLE public.bautagesbericht_workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bautagesbericht_id UUID NOT NULL REFERENCES public.bautagesberichte(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_main BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_bautagesbericht_worker UNIQUE (bautagesbericht_id, user_id)
);

-- Verwendete Materialien (wie disturbance_materials inkl. einheit)
CREATE TABLE public.bautagesbericht_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bautagesbericht_id UUID NOT NULL REFERENCES public.bautagesberichte(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  material TEXT NOT NULL,
  menge TEXT,
  einheit TEXT DEFAULT 'Stk.',
  notizen TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fotos (wie disturbance_photos)
CREATE TABLE public.bautagesbericht_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bautagesbericht_id UUID NOT NULL REFERENCES public.bautagesberichte(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS aktivieren
ALTER TABLE public.bautagesberichte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bautagesbericht_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bautagesbericht_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bautagesbericht_photos ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- RLS Policies für bautagesberichte (Owner + Admin, wie disturbances)
-- ---------------------------------------------------------------------
CREATE POLICY "Users can view own bautagesberichte"
ON public.bautagesberichte FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bautagesberichte"
ON public.bautagesberichte FOR SELECT
USING (has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Users can insert own bautagesberichte"
ON public.bautagesberichte FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bautagesberichte"
ON public.bautagesberichte FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all bautagesberichte"
ON public.bautagesberichte FOR UPDATE
USING (has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Users can delete own bautagesberichte"
ON public.bautagesberichte FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete all bautagesberichte"
ON public.bautagesberichte FOR DELETE
USING (has_role(auth.uid(), 'administrator'::app_role));

-- ---------------------------------------------------------------------
-- RLS Policies für bautagesbericht_workers (EXISTS auf Parent, wie
-- disturbance_workers)
-- ---------------------------------------------------------------------
CREATE POLICY "Authenticated users can view bautagesbericht workers"
  ON public.bautagesbericht_workers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert bautagesbericht workers for own berichte"
  ON public.bautagesbericht_workers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bautagesberichte
      WHERE id = bautagesbericht_id AND user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'administrator'::app_role)
  );

CREATE POLICY "Users can update bautagesbericht workers for own berichte"
  ON public.bautagesbericht_workers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bautagesberichte
      WHERE id = bautagesbericht_id AND user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'administrator'::app_role)
  );

CREATE POLICY "Users can delete bautagesbericht workers for own berichte"
  ON public.bautagesbericht_workers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.bautagesberichte
      WHERE id = bautagesbericht_id AND user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'administrator'::app_role)
  );

-- ---------------------------------------------------------------------
-- RLS Policies für bautagesbericht_materials (wie disturbance_materials)
-- ---------------------------------------------------------------------
CREATE POLICY "Authenticated users can view bautagesbericht materials"
ON public.bautagesbericht_materials FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own bautagesbericht materials"
ON public.bautagesbericht_materials FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bautagesbericht materials"
ON public.bautagesbericht_materials FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bautagesbericht materials"
ON public.bautagesbericht_materials FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any bautagesbericht materials"
ON public.bautagesbericht_materials FOR DELETE
USING (has_role(auth.uid(), 'administrator'::app_role));

-- ---------------------------------------------------------------------
-- RLS Policies für bautagesbericht_photos (wie disturbance_photos)
-- ---------------------------------------------------------------------
CREATE POLICY "Authenticated users can view bautagesbericht photos"
ON public.bautagesbericht_photos FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own bautagesbericht photos"
ON public.bautagesbericht_photos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bautagesbericht photos"
ON public.bautagesbericht_photos FOR DELETE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'administrator'::app_role));

-- ---------------------------------------------------------------------
-- updated_at-Trigger
-- ---------------------------------------------------------------------
CREATE TRIGGER update_bautagesberichte_updated_at
BEFORE UPDATE ON public.bautagesberichte
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bautagesbericht_materials_updated_at
BEFORE UPDATE ON public.bautagesbericht_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- Storage: PUBLIC Bucket für Fotos (wie disturbance-photos)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('bautagesbericht-photos', 'bautagesbericht-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload bautagesbericht photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'bautagesbericht-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view bautagesbericht photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'bautagesbericht-photos');

CREATE POLICY "Users can delete own bautagesbericht photos storage"
ON storage.objects FOR DELETE
USING (bucket_id = 'bautagesbericht-photos' AND auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------
-- Storage: PRIVATE Bucket für PDFs (wie regiebericht-pdfs)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('bautagesbericht-pdfs', 'bautagesbericht-pdfs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users can read bautagesbericht pdfs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bautagesbericht-pdfs');

CREATE POLICY "Auth users can upload bautagesbericht pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bautagesbericht-pdfs');

CREATE POLICY "Service role can manage bautagesbericht pdfs"
  ON storage.objects FOR ALL
  USING (bucket_id = 'bautagesbericht-pdfs')
  WITH CHECK (bucket_id = 'bautagesbericht-pdfs');

-- ---------------------------------------------------------------------
-- role_permissions-Seed für Feature 'bautagesberichte'
-- (administrator + vorarbeiter + mitarbeiter erlauben; überschreibt
--  ggf. vorhandene Zeilen aus 20260412100000_role_permissions.sql)
-- ---------------------------------------------------------------------
INSERT INTO public.role_permissions (role, feature, can_view, can_edit) VALUES
  ('administrator', 'bautagesberichte', true, true),
  ('vorarbeiter',   'bautagesberichte', true, true),
  ('mitarbeiter',   'bautagesberichte', true, true)
ON CONFLICT (role, feature) DO UPDATE
  SET can_view = EXCLUDED.can_view,
      can_edit = EXCLUDED.can_edit,
      updated_at = now();
