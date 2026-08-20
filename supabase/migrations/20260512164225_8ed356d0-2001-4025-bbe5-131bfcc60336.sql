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

    IF COALESCE(NEW.content_type, 'post') = 'story' THEN
      -- Stories are media-only; caption is optional but media is required
      IF (NEW.image_url IS NULL OR length(btrim(NEW.image_url)) = 0)
         AND (NEW.cover_image_url IS NULL OR length(btrim(NEW.cover_image_url)) = 0) THEN
        RAISE EXCEPTION 'Cannot schedule/publish story: media (image or video) is required';
      END IF;
    ELSE
      -- Posts and reels require non-empty caption
      IF NEW.content IS NULL OR length(btrim(NEW.content)) < 1 THEN
        RAISE EXCEPTION 'Cannot schedule/publish: content cannot be empty';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;