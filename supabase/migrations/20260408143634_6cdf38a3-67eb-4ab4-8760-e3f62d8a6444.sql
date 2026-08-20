
-- Table for super-admin managed user access overrides
CREATE TABLE public.user_access_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  agents text[] DEFAULT '{}',
  automations text[] DEFAULT '{}',
  updated_by text,
  updated_at timestamptz DEFAULT now(),
  company_id text NOT NULL DEFAULT 'rebar'
);

ALTER TABLE public.user_access_overrides ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "Admins can view overrides"
  ON public.user_access_overrides
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert
CREATE POLICY "Admins can insert overrides"
  ON public.user_access_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update
CREATE POLICY "Admins can update overrides"
  ON public.user_access_overrides
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete overrides"
  ON public.user_access_overrides
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
