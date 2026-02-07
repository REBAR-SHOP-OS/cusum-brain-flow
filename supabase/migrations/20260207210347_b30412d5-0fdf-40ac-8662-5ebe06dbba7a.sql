
-- Clearance evidence: one row per cut_plan_item for QC verification
CREATE TABLE public.clearance_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cut_plan_item_id UUID NOT NULL REFERENCES public.cut_plan_items(id) ON DELETE CASCADE,
  material_photo_url TEXT,
  tag_scan_url TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cut_plan_item_id)
);

-- Enable RLS
ALTER TABLE public.clearance_evidence ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view clearance evidence"
  ON public.clearance_evidence FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin and workshop can insert clearance evidence"
  ON public.clearance_evidence FOR INSERT
  TO authenticated WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','workshop']::app_role[])
  );

CREATE POLICY "Admin and workshop can update clearance evidence"
  ON public.clearance_evidence FOR UPDATE
  TO authenticated USING (
    public.has_any_role(auth.uid(), ARRAY['admin','workshop']::app_role[])
  );

-- Timestamp trigger
CREATE TRIGGER update_clearance_evidence_updated_at
  BEFORE UPDATE ON public.clearance_evidence
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.clearance_evidence;

-- Storage bucket for clearance photos
INSERT INTO storage.buckets (id, name, public) VALUES ('clearance-photos', 'clearance-photos', true);

-- Storage policies
CREATE POLICY "Authenticated users can view clearance photos"
  ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'clearance-photos');

CREATE POLICY "Admin and workshop can upload clearance photos"
  ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'clearance-photos' AND
    public.has_any_role(auth.uid(), ARRAY['admin','workshop']::app_role[])
  );
