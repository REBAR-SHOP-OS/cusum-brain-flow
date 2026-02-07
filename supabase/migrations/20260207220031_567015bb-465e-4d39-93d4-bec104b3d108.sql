-- Create a security definer function to check channel membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_channel_member(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_channel_members tcm
    JOIN public.profiles p ON p.id = tcm.profile_id
    WHERE tcm.channel_id = _channel_id
      AND p.user_id = _user_id
  )
$$;

-- Drop the recursive policies
DROP POLICY IF EXISTS "Users can view members of their channels" ON public.team_channel_members;
DROP POLICY IF EXISTS "Users can view channels they belong to" ON public.team_channels;
DROP POLICY IF EXISTS "Members can send messages in their channels" ON public.team_messages;
DROP POLICY IF EXISTS "Users can view messages in their channels" ON public.team_messages;

-- Recreate policies using the security definer function
CREATE POLICY "Users can view members of their channels"
ON public.team_channel_members
FOR SELECT
USING (
  is_channel_member(auth.uid(), channel_id)
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role])
);

CREATE POLICY "Users can view channels they belong to"
ON public.team_channels
FOR SELECT
USING (
  is_channel_member(auth.uid(), id)
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role])
);

CREATE POLICY "Members can send messages in their channels"
ON public.team_messages
FOR INSERT
WITH CHECK (
  is_channel_member(auth.uid(), channel_id)
  AND sender_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "Users can view messages in their channels"
ON public.team_messages
FOR SELECT
USING (
  is_channel_member(auth.uid(), channel_id)
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role])
);
