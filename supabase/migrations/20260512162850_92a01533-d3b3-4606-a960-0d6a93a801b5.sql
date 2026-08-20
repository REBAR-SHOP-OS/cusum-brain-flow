CREATE OR REPLACE FUNCTION public.block_social_publish_without_qa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('scheduled', 'published')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.qa_status NOT IN ('approved', 'scheduled', 'published') THEN
      RAISE EXCEPTION 'Cannot schedule/publish: QA status must be approved first';
    END IF;
    IF NEW.content IS NULL OR length(btrim(NEW.content)) < 1 THEN
      RAISE EXCEPTION 'Cannot schedule/publish: content cannot be empty';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;