
-- Helper function: is this user one of the social media team?
CREATE OR REPLACE FUNCTION public.is_social_team()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email IN ('radin@rebar.shop', 'zahra@rebar.shop', 'neel@rebar.shop')
  )
$$;

-- Replace all 4 policies
DROP POLICY IF EXISTS "Users can view their own posts" ON social_posts;
DROP POLICY IF EXISTS "Users can create their own posts" ON social_posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON social_posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON social_posts;

CREATE POLICY "Social team can view all posts"
  ON social_posts FOR SELECT TO authenticated
  USING (public.is_social_team());

CREATE POLICY "Social team can create posts"
  ON social_posts FOR INSERT TO authenticated
  WITH CHECK (public.is_social_team());

CREATE POLICY "Social team can update all posts"
  ON social_posts FOR UPDATE TO authenticated
  USING (public.is_social_team());

CREATE POLICY "Social team can delete all posts"
  ON social_posts FOR DELETE TO authenticated
  USING (public.is_social_team());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
