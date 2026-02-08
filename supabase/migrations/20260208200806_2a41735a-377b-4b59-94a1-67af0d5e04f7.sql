
-- Create a public storage bucket for social media generated assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-media-assets', 'social-media-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload social media assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'social-media-assets');

-- Allow public read access
CREATE POLICY "Public read access for social media assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'social-media-assets');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update social media assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'social-media-assets');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete social media assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'social-media-assets');
