-- Create private bucket for raw video uploads (Auto-Edit flow)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'raw-uploads',
  'raw-uploads',
  false,
  104857600, -- 100MB
  ARRAY['video/mp4','video/quicktime','video/webm','video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS: users can manage only their own folder (path: <auth.uid()>/...)
CREATE POLICY "raw_uploads_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'raw-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "raw_uploads_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'raw-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "raw_uploads_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'raw-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "raw_uploads_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'raw-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);