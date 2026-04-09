-- Step 1: Delete unauthorized user aw.danandeh@gmail.com completely
DELETE FROM activity_events WHERE actor_id = '864b8382-9c57-4648-9d68-f958af801e01';
DELETE FROM profiles WHERE user_id = '864b8382-9c57-4648-9d68-f958af801e01';
DELETE FROM auth.users WHERE id = '864b8382-9c57-4648-9d68-f958af801e01';

-- Step 2: Server-side signup restriction trigger on auth.users
CREATE OR REPLACE FUNCTION public.restrict_signups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_emails text[] := ARRAY[
    'sattar@rebar.shop', 'radin@rebar.shop', 'zahra@rebar.shop',
    'neel@rebar.shop', 'vicky@rebar.shop', 'kourosh@rebar.shop',
    'saurabh@rebar.shop', 'ben@rebar.shop', 'ai@rebar.shop',
    'tariq0001010@gmail.com'
  ];
BEGIN
  IF NOT (lower(NEW.email) = ANY(allowed_emails)) THEN
    RAISE EXCEPTION 'Signup not allowed for this email'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_allowed_signups
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_signups();