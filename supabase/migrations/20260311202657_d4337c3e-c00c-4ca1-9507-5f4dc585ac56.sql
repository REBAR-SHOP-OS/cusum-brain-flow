
-- Create generated-videos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-videos', 'generated-videos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload to their own folder
CREATE POLICY "Users can upload own videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: anyone can read (public bucket)
CREATE POLICY "Public read generated videos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'generated-videos');

-- RLS: users can delete own videos
CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
