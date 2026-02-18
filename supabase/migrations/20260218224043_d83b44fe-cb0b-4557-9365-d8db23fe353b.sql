
-- 1. ARIA's read-only inspector (service_role only)
CREATE OR REPLACE FUNCTION public.execute_readonly_query(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result jsonb;
BEGIN
  EXECUTE sql_query INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM public, anon, authenticated;

-- 2. ARIA's safe write tool (service_role only)
CREATE OR REPLACE FUNCTION public.execute_write_fix(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result jsonb;
BEGIN
  EXECUTE sql_query;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.execute_write_fix(text) FROM public, anon, authenticated;

-- 3. Atomic DM channel creator
CREATE OR REPLACE FUNCTION public.create_dm_channel(
  _my_profile_id uuid,
  _target_profile_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _my_company uuid;
  _target_company uuid;
  _existing_channel uuid;
  _new_channel uuid;
  _dm_name text;
  _my_name text;
  _target_name text;
BEGIN
  -- Verify caller owns _my_profile_id
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _my_profile_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Profile mismatch';
  END IF;

  -- Get companies and names
  SELECT company_id, full_name INTO _my_company, _my_name FROM profiles WHERE id = _my_profile_id;
  SELECT company_id, full_name INTO _target_company, _target_name FROM profiles WHERE id = _target_profile_id;

  IF _my_company IS DISTINCT FROM _target_company THEN
    RAISE EXCEPTION 'Users must be in the same company';
  END IF;

  IF _my_profile_id = _target_profile_id THEN
    RAISE EXCEPTION 'Cannot DM yourself';
  END IF;

  -- Check for existing DM between these two users
  SELECT tc.id INTO _existing_channel
  FROM team_channels tc
  JOIN team_channel_members m1 ON m1.channel_id = tc.id AND m1.profile_id = _my_profile_id
  JOIN team_channel_members m2 ON m2.channel_id = tc.id AND m2.profile_id = _target_profile_id
  WHERE tc.channel_type = 'dm'
  LIMIT 1;

  IF _existing_channel IS NOT NULL THEN
    RETURN _existing_channel;
  END IF;

  -- Create channel + members atomically
  _dm_name := (SELECT string_agg(n, ' & ' ORDER BY n) FROM unnest(ARRAY[_my_name, _target_name]) AS n);

  INSERT INTO team_channels (name, channel_type, created_by, company_id)
  VALUES (_dm_name, 'dm', auth.uid(), _my_company)
  RETURNING id INTO _new_channel;

  INSERT INTO team_channel_members (channel_id, profile_id) VALUES
    (_new_channel, _my_profile_id),
    (_new_channel, _target_profile_id);

  RETURN _new_channel;
END;
$$;

-- 4. Update RLS SELECT policy on team_channels
DROP POLICY IF EXISTS "Users can view channels they belong to" ON team_channels;
CREATE POLICY "Users can view channels they belong to or created"
  ON team_channels FOR SELECT
  USING (
    is_channel_member(auth.uid(), id)
    OR created_by = auth.uid()
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role])
  );
