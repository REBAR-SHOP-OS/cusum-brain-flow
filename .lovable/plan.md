

# Sync Social Media Posts Between 3 Users

## Problem
The `social_posts` table has RLS policies restricting each user to only see/edit their own posts (`auth.uid() = user_id`). Posts created by Radin are invisible to Zahra and Neel, and vice versa.

## Solution
Update the RLS policies so that these 3 users (radin@rebar.shop, zahra@rebar.shop, neel@rebar.shop) can see AND manage all social media posts from each other.

### Database Migration

Create a helper function and update all 4 RLS policies:

```sql
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

-- Replace all 4 policies to allow full cross-access for team members
DROP POLICY "Users can view their own posts" ON social_posts;
CREATE POLICY "Social team can view all posts"
  ON social_posts FOR SELECT TO authenticated
  USING (public.is_social_team());

DROP POLICY "Users can create their own posts" ON social_posts;
CREATE POLICY "Social team can create posts"
  ON social_posts FOR INSERT TO authenticated
  WITH CHECK (public.is_social_team());

DROP POLICY "Users can update their own posts" ON social_posts;
CREATE POLICY "Social team can update all posts"
  ON social_posts FOR UPDATE TO authenticated
  USING (public.is_social_team());

DROP POLICY "Users can delete their own posts" ON social_posts;
CREATE POLICY "Social team can delete all posts"
  ON social_posts FOR DELETE TO authenticated
  USING (public.is_social_team());
```

### Frontend — No Code Changes Needed
`useSocialPosts.ts` already queries `.from("social_posts").select("*")` without any `user_id` filter. Once RLS allows cross-access, all posts will automatically appear for all 3 users.

### Realtime Sync
Enable realtime on `social_posts` so changes by one user instantly appear for the others:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
```
Then add a small realtime subscription in `useSocialPosts.ts` to auto-invalidate the query when any post changes.

