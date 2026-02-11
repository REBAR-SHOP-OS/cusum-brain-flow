
-- Create social-images bucket for Pixel generated content
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-images', 'social-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read social-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'social-images');

-- Allow service role (edge functions) to upload
CREATE POLICY "Service role upload social-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'social-images');
