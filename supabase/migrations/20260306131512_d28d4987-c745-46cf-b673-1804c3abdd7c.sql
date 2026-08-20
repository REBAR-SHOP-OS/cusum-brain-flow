CREATE OR REPLACE FUNCTION public.validate_clockin_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_email text;
  current_hour_et int;
BEGIN
  SELECT email INTO profile_email
  FROM profiles
  WHERE id = NEW.profile_id;

  IF lower(profile_email) LIKE '%@rebar.shop' AND lower(profile_email) != 'kourosh@rebar.shop' THEN
    current_hour_et := EXTRACT(HOUR FROM (now() AT TIME ZONE 'America/New_York'));
    IF current_hour_et < 8 THEN
      RAISE EXCEPTION 'Clock-in is only available from 8:00 AM ET';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_clockin_time ON time_clock_entries;

CREATE TRIGGER trg_validate_clockin_time
  BEFORE INSERT ON time_clock_entries
  FOR EACH ROW
  EXECUTE FUNCTION validate_clockin_time();