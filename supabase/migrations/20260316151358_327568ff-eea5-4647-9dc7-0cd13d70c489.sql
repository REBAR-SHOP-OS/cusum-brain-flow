CREATE OR REPLACE FUNCTION public.block_social_publish_without_qa()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Only validate when status is CHANGING to scheduled/published
  IF NEW.status IN ('scheduled', 'published')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.qa_status NOT IN ('approved', 'scheduled', 'published') THEN
      RAISE EXCEPTION 'Cannot schedule/publish: QA status must be approved first';
    END IF;
    IF length(NEW.content) < 20 THEN
      RAISE EXCEPTION 'Cannot schedule/publish: content must be at least 20 characters';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;