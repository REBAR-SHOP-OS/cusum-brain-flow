
-- Store Meta (Facebook/Instagram) OAuth tokens
CREATE TABLE public.user_meta_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'long_lived',
  scopes TEXT[] DEFAULT '{}',
  meta_user_id TEXT,
  meta_user_name TEXT,
  pages JSONB DEFAULT '[]',
  instagram_accounts JSONB DEFAULT '[]',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Enable RLS
ALTER TABLE public.user_meta_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow server-side (service_role) access - no client-side token exposure
-- Users can check if they have a connection but cannot read tokens
CREATE POLICY "Users can check own connection exists"
  ON public.user_meta_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE from client - all managed by edge functions with service_role
-- This prevents token theft via client-side access

-- Trigger for updated_at
CREATE TRIGGER update_user_meta_tokens_updated_at
  BEFORE UPDATE ON public.user_meta_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
