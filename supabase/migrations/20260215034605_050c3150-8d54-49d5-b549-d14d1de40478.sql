
-- Add multi-source harvest columns to seo_keyword_ai
ALTER TABLE public.seo_keyword_ai
  ADD COLUMN IF NOT EXISTS sources TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS business_relevance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sample_context TEXT,
  ADD COLUMN IF NOT EXISTS harvested_at TIMESTAMPTZ;

-- Index for source-based filtering and sorting
CREATE INDEX IF NOT EXISTS idx_seo_keyword_ai_source_count ON public.seo_keyword_ai (source_count DESC);
CREATE INDEX IF NOT EXISTS idx_seo_keyword_ai_business_relevance ON public.seo_keyword_ai (business_relevance DESC);
