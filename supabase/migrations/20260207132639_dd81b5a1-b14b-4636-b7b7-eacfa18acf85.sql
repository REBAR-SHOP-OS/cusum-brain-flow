-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload to estimation-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update estimation-files" ON storage.objects;

-- Recreate with owner-scoped policies
CREATE POLICY "Auth users upload to estimation-files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'estimation-files' AND (auth.uid())::text = owner_id::text);

CREATE POLICY "Auth users update own estimation-files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'estimation-files' AND (auth.uid())::text = owner_id::text);
