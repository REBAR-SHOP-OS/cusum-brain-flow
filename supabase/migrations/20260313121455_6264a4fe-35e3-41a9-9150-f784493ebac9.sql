CREATE OR REPLACE FUNCTION public.validate_clockin_time()
RETURNS TRIGGER AS $$
BEGIN
  IF extract(hour from (now() at time zone 'America/New_York')) < 6 THEN
    RAISE EXCEPTION 'Clock-in is only available from 6:00 AM ET';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;