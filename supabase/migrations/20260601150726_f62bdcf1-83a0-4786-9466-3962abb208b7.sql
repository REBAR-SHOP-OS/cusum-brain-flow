ALTER TABLE public.story_banner_references
  ADD COLUMN IF NOT EXISTS product text NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS idx_story_banner_references_user_product_created
  ON public.story_banner_references (user_id, product, created_at);