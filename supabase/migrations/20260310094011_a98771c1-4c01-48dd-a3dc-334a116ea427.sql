CREATE OR REPLACE FUNCTION validate_extract_session_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status NOT IN ('uploaded','extracting','extracted','mapping','mapped','validated','approved','rejected') THEN
    RAISE EXCEPTION 'Invalid extract_session status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;