
-- Fix: Add sattar to social team
CREATE OR REPLACE FUNCTION public.is_social_team()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email IN (
        'radin@rebar.shop',
        'zahra@rebar.shop',
        'neel@rebar.shop',
        'sattar@rebar.shop'
      )
  )
$$;

-- Fix: Team-wide approval visibility
DROP POLICY IF EXISTS "Approvers can view their approvals" ON social_approvals;
DROP POLICY IF EXISTS "Post owners can view approvals" ON social_approvals;
DROP POLICY IF EXISTS "Approvers can update their approvals" ON social_approvals;

CREATE POLICY "Social team can view all approvals"
  ON social_approvals FOR SELECT TO authenticated
  USING (public.is_social_team());

CREATE POLICY "Social team can update approvals"
  ON social_approvals FOR UPDATE TO authenticated
  USING (public.is_social_team());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_approvals;
