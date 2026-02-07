-- Store per-user Gmail OAuth tokens
CREATE TABLE public.user_gmail_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_email TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_gmail_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own token
CREATE POLICY "Users can view their own gmail token"
  ON public.user_gmail_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own token
CREATE POLICY "Users can insert their own gmail token"
  ON public.user_gmail_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own token
CREATE POLICY "Users can update their own gmail token"
  ON public.user_gmail_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own token
CREATE POLICY "Users can delete their own gmail token"
  ON public.user_gmail_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-update timestamp
CREATE TRIGGER update_user_gmail_tokens_updated_at
  BEFORE UPDATE ON public.user_gmail_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();