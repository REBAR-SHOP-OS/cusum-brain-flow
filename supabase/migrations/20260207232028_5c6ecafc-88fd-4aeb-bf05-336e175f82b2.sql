
-- Per-user RingCentral OAuth tokens
CREATE TABLE public.user_ringcentral_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rc_email TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_ringcentral_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own RC tokens"
  ON public.user_ringcentral_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own RC tokens"
  ON public.user_ringcentral_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own RC tokens"
  ON public.user_ringcentral_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own RC tokens"
  ON public.user_ringcentral_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_ringcentral_tokens_updated_at
  BEFORE UPDATE ON public.user_ringcentral_tokens
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
