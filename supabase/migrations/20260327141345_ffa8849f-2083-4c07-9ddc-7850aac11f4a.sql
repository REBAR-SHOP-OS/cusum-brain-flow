
CREATE POLICY "Admins can upload face photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'face-enrollments'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete face photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'face-enrollments'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
