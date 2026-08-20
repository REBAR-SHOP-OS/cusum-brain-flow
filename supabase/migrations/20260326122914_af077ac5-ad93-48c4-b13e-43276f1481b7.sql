INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-assets', 'ad-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload ad assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ad-assets');

CREATE POLICY "Public read access for ad assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'ad-assets');