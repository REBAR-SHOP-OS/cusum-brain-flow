
-- Create brand-assets storage bucket for persistent logo uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users upload own brand assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read their own assets
CREATE POLICY "Users read own brand assets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read for brand assets (needed for watermark in videos)
CREATE POLICY "Public read brand assets"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'brand-assets');

-- Allow users to delete their own brand assets
CREATE POLICY "Users delete own brand assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
