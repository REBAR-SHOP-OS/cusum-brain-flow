
ALTER TABLE public.social_posts 
  ADD COLUMN IF NOT EXISTS publishing_lock_id uuid,
  ADD COLUMN IF NOT EXISTS publishing_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_social_posts_publishing_lock 
  ON public.social_posts(status, publishing_started_at);
