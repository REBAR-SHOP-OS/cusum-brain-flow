
DROP POLICY IF EXISTS "Admin and workshop can upload clearance photos" ON storage.objects;

CREATE POLICY "Upload clearance photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'clearance-photos'
  AND (
    (storage.foldername(name))[1] = 'feedback-screenshots'
    OR
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
  )
);
