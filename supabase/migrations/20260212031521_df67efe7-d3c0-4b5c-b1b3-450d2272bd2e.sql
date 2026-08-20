
-- Fix: The upload policy already existed, just ensure the read policy didn't fail too
-- Drop and recreate to be safe
DROP POLICY IF EXISTS "Authenticated users can upload shape schematics" ON storage.objects;
CREATE POLICY "Authenticated users can upload shape schematics"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shape-schematics');
