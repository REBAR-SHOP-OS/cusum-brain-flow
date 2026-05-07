
-- ============================================================
-- Security fixes from scan results
-- ============================================================

-- 1) CAMERAS: restrict access to admin / workshop / shop_supervisor roles only
--    (still company-scoped). Removes plaintext password exposure to all members.
DROP POLICY IF EXISTS "Users see own company cameras" ON public.cameras;
DROP POLICY IF EXISTS "Users insert own company cameras" ON public.cameras;
DROP POLICY IF EXISTS "Users update own company cameras" ON public.cameras;
DROP POLICY IF EXISTS "Users delete own company cameras" ON public.cameras;

CREATE POLICY "Camera admins read company cameras"
ON public.cameras FOR SELECT
TO authenticated
USING (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'workshop')
    OR public.has_role(auth.uid(), 'shop_supervisor')
  )
);

CREATE POLICY "Camera admins insert company cameras"
ON public.cameras FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'workshop')
    OR public.has_role(auth.uid(), 'shop_supervisor')
  )
);

CREATE POLICY "Camera admins update company cameras"
ON public.cameras FOR UPDATE
TO authenticated
USING (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'workshop')
    OR public.has_role(auth.uid(), 'shop_supervisor')
  )
);

CREATE POLICY "Camera admins delete company cameras"
ON public.cameras FOR DELETE
TO authenticated
USING (
  company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'workshop')
    OR public.has_role(auth.uid(), 'shop_supervisor')
  )
);

-- 2) INVOICE-PDFS: company-scoped read via sales_invoices join
DROP POLICY IF EXISTS "Authenticated users can read invoice PDFs" ON storage.objects;

CREATE POLICY "Company members read invoice PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-pdfs'
  AND EXISTS (
    SELECT 1 FROM public.sales_invoices si
    JOIN public.profiles p ON p.company_id = si.company_id
    WHERE si.id::text = (storage.foldername(name))[1]
      AND p.user_id = auth.uid()
  )
);

-- 3) DOCUMENT-ATTACHMENTS: company-scoped read via document_attachments join
DROP POLICY IF EXISTS "Authenticated users can read document attachments" ON storage.objects;

CREATE POLICY "Company members read document attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'document-attachments'
  AND EXISTS (
    SELECT 1 FROM public.document_attachments da
    JOIN public.profiles p ON p.company_id = da.company_id
    WHERE da.file_path = name
      AND p.user_id = auth.uid()
  )
);

-- 4) MEETING-RECORDINGS: only channel members of the meeting can read
DROP POLICY IF EXISTS "Authenticated users can read meeting recordings" ON storage.objects;

CREATE POLICY "Channel members read meeting recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'meeting-recordings'
  AND EXISTS (
    SELECT 1 FROM public.team_meetings tm
    JOIN public.team_channel_members tcm ON tcm.channel_id = tm.channel_id
    JOIN public.profiles p ON p.id = tcm.profile_id
    WHERE tm.id::text = (storage.foldername(name))[1]
      AND p.user_id = auth.uid()
  )
);

-- 5) TEAM-CHAT-FILES: make bucket private, drop public policy, allow only authenticated reads
UPDATE storage.buckets SET public = false WHERE id = 'team-chat-files';

DROP POLICY IF EXISTS "Public read access on team-chat-files" ON storage.objects;

CREATE POLICY "Authenticated users read team-chat-files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'team-chat-files');
