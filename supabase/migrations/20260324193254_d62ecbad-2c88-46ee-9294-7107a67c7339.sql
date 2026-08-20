
CREATE OR REPLACE FUNCTION public.create_dm_channel(_my_profile_id uuid, _target_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _my_company uuid;
  _target_company uuid;
  _existing_channel uuid;
  _new_channel uuid;
  _dm_name text;
  _my_name text;
  _target_name text;
  _is_self boolean;
BEGIN
  -- Verify caller owns _my_profile_id
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _my_profile_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Profile mismatch';
  END IF;

  _is_self := (_my_profile_id = _target_profile_id);

  -- Get companies and names
  SELECT company_id, full_name INTO _my_company, _my_name FROM profiles WHERE id = _my_profile_id;
  
  IF _is_self THEN
    _target_company := _my_company;
    _target_name := _my_name;
  ELSE
    SELECT company_id, full_name INTO _target_company, _target_name FROM profiles WHERE id = _target_profile_id;
  END IF;

  IF _my_company IS DISTINCT FROM _target_company THEN
    RAISE EXCEPTION 'Users must be in the same company';
  END IF;

  IF _is_self THEN
    -- Check for existing self-notes channel
    SELECT tc.id INTO _existing_channel
    FROM team_channels tc
    JOIN team_channel_members m1 ON m1.channel_id = tc.id AND m1.profile_id = _my_profile_id
    WHERE tc.channel_type = 'dm' AND tc.name = '__self_notes__'
    LIMIT 1;

    IF _existing_channel IS NOT NULL THEN
      RETURN _existing_channel;
    END IF;

    INSERT INTO team_channels (name, channel_type, created_by, company_id)
    VALUES ('__self_notes__', 'dm', auth.uid(), _my_company)
    RETURNING id INTO _new_channel;

    INSERT INTO team_channel_members (channel_id, profile_id) VALUES (_new_channel, _my_profile_id);

    RETURN _new_channel;
  END IF;

  -- Normal DM flow
  SELECT tc.id INTO _existing_channel
  FROM team_channels tc
  JOIN team_channel_members m1 ON m1.channel_id = tc.id AND m1.profile_id = _my_profile_id
  JOIN team_channel_members m2 ON m2.channel_id = tc.id AND m2.profile_id = _target_profile_id
  WHERE tc.channel_type = 'dm' AND tc.name != '__self_notes__'
  LIMIT 1;

  IF _existing_channel IS NOT NULL THEN
    RETURN _existing_channel;
  END IF;

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
