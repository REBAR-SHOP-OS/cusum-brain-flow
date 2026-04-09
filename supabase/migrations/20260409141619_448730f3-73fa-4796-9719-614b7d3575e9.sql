
-- Create allowed_login_emails table
CREATE TABLE public.allowed_login_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  added_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.allowed_login_emails ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Authenticated users can read allowed emails"
  ON public.allowed_login_emails FOR SELECT
  TO authenticated USING (true);

-- Super admins can insert
CREATE POLICY "Super admins can insert allowed emails"
  ON public.allowed_login_emails FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('sattar@rebar.shop', 'radin@rebar.shop', 'zahra@rebar.shop')
  );

-- Super admins can delete
CREATE POLICY "Super admins can delete allowed emails"
  ON public.allowed_login_emails FOR DELETE
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('sattar@rebar.shop', 'radin@rebar.shop', 'zahra@rebar.shop')
  );

-- Seed current whitelist
INSERT INTO public.allowed_login_emails (email) VALUES
  ('sattar@rebar.shop'),
  ('radin@rebar.shop'),
  ('zahra@rebar.shop'),
  ('neel@rebar.shop'),
  ('vicky@rebar.shop'),
  ('kourosh@rebar.shop'),
  ('saurabh@rebar.shop'),
  ('ben@rebar.shop'),
  ('ai@rebar.shop'),
  ('tariq0001010@gmail.com');

-- Update restrict_signups to read from the table
CREATE OR REPLACE FUNCTION public.restrict_signups()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.allowed_login_emails WHERE email = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'Signups are restricted to approved emails only.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
