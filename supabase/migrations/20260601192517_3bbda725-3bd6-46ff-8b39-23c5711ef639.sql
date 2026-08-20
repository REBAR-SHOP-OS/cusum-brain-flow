CREATE OR REPLACE FUNCTION public.enforce_neel_only_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_email text;
BEGIN
  IF NEW.neel_approved IS DISTINCT FROM COALESCE(OLD.neel_approved, false)
     AND NEW.neel_approved = true THEN
    IF auth.uid() IS NULL THEN
      -- Service-role / cron paths must never flip neel_approved.
      RAISE EXCEPTION 'neel_approved can only be set by neel@rebar.shop (no service-role bypass)';
    END IF;
    SELECT lower(email) INTO acting_email FROM auth.users WHERE id = auth.uid();
    IF acting_email IS DISTINCT FROM 'neel@rebar.shop' THEN
      RAISE EXCEPTION 'Only neel@rebar.shop can approve social posts';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_neel_only_approval ON public.social_posts;
CREATE TRIGGER trg_enforce_neel_only_approval
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_neel_only_approval();