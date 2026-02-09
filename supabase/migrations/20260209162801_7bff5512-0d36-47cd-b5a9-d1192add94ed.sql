
-- Create email signatures table
CREATE TABLE public.email_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signature_html TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.email_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own signature"
  ON public.email_signatures FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own signature"
  ON public.email_signatures FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own signature"
  ON public.email_signatures FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can read any signature (for edge functions)
CREATE POLICY "Service role full access"
  ON public.email_signatures FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed signatures for existing users based on profiles
INSERT INTO public.email_signatures (user_id, signature_html)
SELECT p.user_id,
  '<div style="margin-top:16px;padding-top:12px;border-top:2px solid #e85d04;font-family:Arial,sans-serif;">' ||
  '<p style="margin:0;font-weight:700;font-size:14px;color:#1a1a1a;">' || p.full_name || '</p>' ||
  CASE WHEN p.title IS NOT NULL THEN '<p style="margin:2px 0 0;font-size:12px;color:#555;">' || p.title || '</p>' ELSE '' END ||
  '<p style="margin:4px 0 0;font-size:12px;color:#555;">Rebar.Shop — Ontario Rebars Ltd.</p>' ||
  '<p style="margin:2px 0 0;font-size:11px;color:#888;">' || COALESCE(p.email, '') ||
  CASE WHEN p.phone IS NOT NULL THEN ' | ' || p.phone ELSE '' END ||
  '</p>' ||
  '<p style="margin:4px 0 0;font-size:11px;color:#e85d04;font-weight:600;">rebar.shop</p>' ||
  '</div>'
FROM profiles p
WHERE p.user_id IS NOT NULL;
