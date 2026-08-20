
-- 1. estimation_learnings: scope SELECT to company
DROP POLICY IF EXISTS "Authenticated users can read estimation_learnings" ON public.estimation_learnings;
CREATE POLICY "Users read estimation_learnings in their company"
ON public.estimation_learnings
FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

-- Also tighten INSERT to require company match
DROP POLICY IF EXISTS "Authenticated users can insert estimation_learnings" ON public.estimation_learnings;
CREATE POLICY "Users insert estimation_learnings in their company"
ON public.estimation_learnings
FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- 2. system_learnings: scope SELECT/INSERT to company (text column)
DROP POLICY IF EXISTS "Authenticated users can read learnings" ON public.system_learnings;
CREATE POLICY "Users read system_learnings in their company"
ON public.system_learnings
FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid())::text);

DROP POLICY IF EXISTS "Authenticated users can insert learnings" ON public.system_learnings;
CREATE POLICY "Users insert system_learnings in their company"
ON public.system_learnings
FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid())::text);

-- 3. invite_tokens: remove anon SELECT (validate-invite uses service role)
DROP POLICY IF EXISTS "Validate token" ON public.invite_tokens;

-- 4. team-chat-files: restrict raw SELECT to uploader; signed URLs still work for shared links
DROP POLICY IF EXISTS "Authenticated users can read team chat files" ON storage.objects;
CREATE POLICY "Uploader reads own team chat files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'team-chat-files' AND owner = auth.uid());
