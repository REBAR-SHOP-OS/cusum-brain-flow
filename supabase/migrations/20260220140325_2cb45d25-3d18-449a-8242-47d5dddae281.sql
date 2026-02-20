
-- Fix idempotency conflict for vector extension and document_embeddings objects
-- Drop conflicting objects safely before recreating them

-- Drop trigger if exists
DROP TRIGGER IF EXISTS update_document_embeddings_updated_at ON public.document_embeddings;

-- Drop policies if they exist
DROP POLICY IF EXISTS "Users can read embeddings for their company" ON public.document_embeddings;
DROP POLICY IF EXISTS "Service role can manage embeddings" ON public.document_embeddings;

-- Drop indexes if they exist
DROP INDEX IF EXISTS public.idx_embeddings_vector;
DROP INDEX IF EXISTS public.idx_embeddings_domain;
DROP INDEX IF EXISTS public.idx_embeddings_entity;
DROP INDEX IF EXISTS public.idx_embeddings_company;

-- Drop the function (it depends on vector type via signature)
DROP FUNCTION IF EXISTS public.match_documents(vector, integer, double precision, text, text);

-- Drop the table if it exists (safe because embeddings are regeneratable)
DROP TABLE IF EXISTS public.document_embeddings;

-- Ensure extension is present
CREATE EXTENSION IF NOT EXISTS vector;

-- Recreate table
CREATE TABLE public.document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
  agent_domain TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  content_text TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recreate indexes
CREATE INDEX idx_embeddings_domain ON public.document_embeddings(agent_domain);
CREATE INDEX idx_embeddings_entity ON public.document_embeddings(entity_type, entity_id);
CREATE INDEX idx_embeddings_company ON public.document_embeddings(company_id);
CREATE INDEX idx_embeddings_vector ON public.document_embeddings USING hnsw (embedding vector_cosine_ops);

-- Enable RLS
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
CREATE POLICY "Users can read embeddings for their company"
  ON public.document_embeddings FOR SELECT
  USING (company_id = (SELECT company_id::text FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Service role can manage embeddings"
  ON public.document_embeddings FOR ALL
  USING (true)
  WITH CHECK (true);

-- Recreate similarity search function
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding extensions.vector,
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7,
  filter_domain TEXT DEFAULT NULL,
  filter_company TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  agent_domain TEXT,
  entity_type TEXT,
  entity_id TEXT,
  content_text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.agent_domain,
    de.entity_type,
    de.entity_id,
    de.content_text,
    de.metadata,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM public.document_embeddings de
  WHERE
    de.embedding IS NOT NULL
    AND (filter_domain IS NULL OR de.agent_domain = filter_domain)
    AND (filter_company IS NULL OR de.company_id = filter_company)
    AND 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Recreate timestamp trigger
CREATE TRIGGER update_document_embeddings_updated_at
  BEFORE UPDATE ON public.document_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
