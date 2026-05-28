
-- 1. automation_configs: require admin role
DROP POLICY IF EXISTS "Admins can manage automation configs" ON public.automation_configs;
CREATE POLICY "Admins can manage automation configs"
ON public.automation_configs
FOR ALL TO authenticated
USING (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- 2. feature_flags: restrict SELECT to super admins; expose user-scoped RPC
DROP POLICY IF EXISTS "Authenticated can read flags" ON public.feature_flags;
CREATE POLICY "Super admins read feature flags"
ON public.feature_flags
FOR SELECT TO authenticated
USING ((auth.jwt() ->> 'email') = ANY (ARRAY['sattar@rebar.shop','radin@rebar.shop','zahra@rebar.shop']));

CREATE OR REPLACE FUNCTION public.get_enabled_features_for_user()
RETURNS TABLE(flag_key text, metadata jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.flag_key, f.metadata
  FROM public.feature_flags f
  WHERE f.enabled = true
    AND (
      (COALESCE(cardinality(f.allowed_roles),0) = 0
        AND COALESCE(cardinality(f.allowed_user_ids),0) = 0
        AND COALESCE(cardinality(f.allowed_emails),0) = 0)
      OR auth.uid() = ANY(f.allowed_user_ids)
      OR (auth.jwt() ->> 'email') = ANY(f.allowed_emails)
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role::text = ANY(f.allowed_roles)
      )
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_enabled_features_for_user() TO authenticated;

-- 3. social_approvals: replace permissive INSERT with role-gated
DROP POLICY IF EXISTS "Authenticated users can create approvals" ON public.social_approvals;
CREATE POLICY "Social team can create approvals"
ON public.social_approvals
FOR INSERT TO authenticated
WITH CHECK (is_social_team());

-- 4. realtime.messages: drop permissive broadcast/presence policies (unused)
DROP POLICY IF EXISTS "Authenticated users can broadcast to realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON realtime.messages;

-- 5. Storage buckets to private
UPDATE storage.buckets SET public = false
WHERE id IN ('estimation-files','clearance-photos','support-attachments');
