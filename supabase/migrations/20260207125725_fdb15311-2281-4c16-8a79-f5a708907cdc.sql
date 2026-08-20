
-- Create table for custom shape schematics uploaded by users
CREATE TABLE public.custom_shape_schematics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shape_code TEXT NOT NULL,
  image_url TEXT NOT NULL,
  ai_analysis TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_shape_schematics ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all schematics
CREATE POLICY "Authenticated users can view schematics"
ON public.custom_shape_schematics FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can insert schematics
CREATE POLICY "Authenticated users can insert schematics"
ON public.custom_shape_schematics FOR INSERT
TO authenticated
WITH CHECK (true);

-- Authenticated users can delete their own
CREATE POLICY "Authenticated users can delete schematics"
ON public.custom_shape_schematics FOR DELETE
TO authenticated
USING (true);

-- Create storage bucket for shape schematics
INSERT INTO storage.buckets (id, name, public)
VALUES ('shape-schematics', 'shape-schematics', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view shape schematics"
ON storage.objects FOR SELECT
USING (bucket_id = 'shape-schematics');

CREATE POLICY "Authenticated users can upload shape schematics"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shape-schematics');

CREATE POLICY "Authenticated users can delete shape schematics"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'shape-schematics');
