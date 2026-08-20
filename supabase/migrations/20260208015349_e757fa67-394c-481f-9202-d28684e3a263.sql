-- Remove client-side SELECT — edge functions use service_role and bypass RLS anyway
-- This prevents a compromised browser session from extracting refresh tokens
DROP POLICY "Users can view their own gmail token" ON public.user_gmail_tokens;

-- Also remove direct DELETE from client — disconnection should go through the edge function
DROP POLICY "Users can delete their own gmail token" ON public.user_gmail_tokens;

-- Add last_used tracking for anomaly detection
ALTER TABLE public.user_gmail_tokens
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_used_ip text;