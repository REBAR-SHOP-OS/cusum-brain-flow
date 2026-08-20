
CREATE TABLE public.invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  email text,
  company_id uuid REFERENCES public.companies(id),
  role text DEFAULT 'user',
  used_at timestamptz,
  expires_at timestamptz DEFAULT now() + interval '7 days',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invites"
  ON public.invite_tokens FOR ALL TO authenticated
  USING (company_id = get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Validate token"
  ON public.invite_tokens FOR SELECT TO anon
  USING (used_at IS NULL AND expires_at > now());
