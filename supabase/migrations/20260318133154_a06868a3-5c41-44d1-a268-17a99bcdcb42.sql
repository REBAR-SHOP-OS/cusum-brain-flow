CREATE OR REPLACE FUNCTION validate_extract_session_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status NOT IN ('uploaded','extracting','extracted','mapping','mapped','validated','approved','rejected','error') THEN
    RAISE EXCEPTION 'Invalid extract_session status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE extract_sessions SET status = 'error', error_message = 'Extraction timed out during row save. Please retry.' WHERE id = 'b3b8dcf9-438a-43a8-8d6f-2da03ee797f2' AND status = 'extracting';