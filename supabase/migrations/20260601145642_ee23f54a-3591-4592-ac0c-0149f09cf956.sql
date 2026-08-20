-- Per-user reference banner gallery for the Story Generator
CREATE TABLE public.story_banner_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_banner_references TO authenticated;
GRANT ALL ON public.story_banner_references TO service_role;

ALTER TABLE public.story_banner_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own story banner references — select"
  ON public.story_banner_references FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own story banner references — insert"
  ON public.story_banner_references FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own story banner references — delete"
  ON public.story_banner_references FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_story_banner_references_user ON public.story_banner_references(user_id, created_at DESC);

-- Style brief cache keyed by SHA-256 of the sorted reference URL set
CREATE TABLE public.story_banner_style_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reference_set_hash TEXT NOT NULL,
  style_brief TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, reference_set_hash)
);

GRANT SELECT ON public.story_banner_style_cache TO authenticated;
GRANT ALL ON public.story_banner_style_cache TO service_role;

ALTER TABLE public.story_banner_style_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own style cache"
  ON public.story_banner_style_cache FOR SELECT
  USING (auth.uid() = user_id);
