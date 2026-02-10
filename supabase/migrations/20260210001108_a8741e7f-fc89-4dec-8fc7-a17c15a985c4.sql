
-- Add encryption metadata and token rotation tracking
ALTER TABLE public.user_gmail_tokens 
ADD COLUMN IF NOT EXISTS is_encrypted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS token_rotated_at timestamptz;
