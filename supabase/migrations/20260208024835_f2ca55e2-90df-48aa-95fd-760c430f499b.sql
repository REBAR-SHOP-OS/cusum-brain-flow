
-- Replace public read policy with authenticated-only read
DROP POLICY IF EXISTS "Public read access to estimation-files" ON storage.objects;

CREATE POLICY "Authenticated users can read estimation-files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'estimation-files');
