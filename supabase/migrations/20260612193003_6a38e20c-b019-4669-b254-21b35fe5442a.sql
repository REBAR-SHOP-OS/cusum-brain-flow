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
      RAISE EXCEPTION 'neel_approved can only be set by an approver (no service-role bypass)';
    END IF;
    SELECT lower(email) INTO acting_email FROM auth.users WHERE id = auth.uid();
    IF acting_email NOT IN ('neel@rebar.shop', 'sattar@rebar.shop') THEN
      RAISE EXCEPTION 'Only neel@rebar.shop or sattar@rebar.shop can approve social posts';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;