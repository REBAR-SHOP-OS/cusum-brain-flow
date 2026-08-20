
-- Drop broad permissive policies
DROP POLICY IF EXISTS "Authenticated users read team-chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload team chat files" ON storage.objects;
DROP POLICY IF EXISTS "Uploader reads own team chat files" ON storage.objects;

-- Helper: caller's company_id (already exists as get_user_company_id)
-- New scoped policies: first folder of path = company_id of caller

CREATE POLICY "team-chat-files: company members read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'team-chat-files'
  AND (storage.foldername(name))[1] = (public.get_user_company_id(auth.uid()))::text
);

CREATE POLICY "team-chat-files: uploader read own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'team-chat-files' AND owner = auth.uid()
);

CREATE POLICY "team-chat-files: company members upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'team-chat-files'
  AND (storage.foldername(name))[1] = (public.get_user_company_id(auth.uid()))::text
);

CREATE POLICY "team-chat-files: uploader update own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'team-chat-files' AND owner = auth.uid())
WITH CHECK (
  bucket_id = 'team-chat-files'
  AND (storage.foldername(name))[1] = (public.get_user_company_id(auth.uid()))::text
);

CREATE POLICY "team-chat-files: uploader delete own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'team-chat-files' AND owner = auth.uid());
