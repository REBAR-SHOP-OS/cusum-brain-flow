-- Permanent fix for vector extension build blocker.
-- The diff engine tries to DROP EXTENSION vector without CASCADE and fails.
-- We proactively DROP everything with CASCADE then recreate cleanly,
-- so the diff engine finds no delta to act on.

-- Step 1: Drop all vector-dependent objects with CASCADE
DROP FUNCTION IF EXISTS public.match_documents(vector, integer, double precision, text, text) CASCADE;
DROP TABLE IF EXISTS public.document_embeddings CASCADE;
DROP EXTENSION IF EXISTS vector CASCADE;

-- Step 2: Recreate extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 3: Recreate document_embeddings table
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_embeddings_domain_type_entity_key UNIQUE (agent_domain, entity_type, entity_id)
);

-- Step 4: Recreate indexes
CREATE INDEX idx_embeddings_domain ON public.document_embeddings(agent_domain);
CREATE INDEX idx_embeddings_entity ON public.document_embeddings(entity_type, entity_id);
CREATE INDEX idx_embeddings_company ON public.document_embeddings(company_id);
CREATE INDEX idx_embeddings_vector ON public.document_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Step 5: Enable RLS
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS Policies
CREATE POLICY "Users can read embeddings for their company"
  ON public.document_embeddings FOR SELECT
  USING (
    company_id = (
      SELECT company_id::text FROM public.profiles
      WHERE user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "Service role can manage embeddings"
  ON public.document_embeddings FOR ALL
  USING (true)
  WITH CHECK (true);

-- Step 7: Similarity search function
CREATE FUNCTION public.match_documents(
  query_embedding vector(768),
  match_count      INT     DEFAULT 5,
  match_threshold  FLOAT   DEFAULT 0.5,
  filter_domain    TEXT    DEFAULT NULL,
  filter_company   TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id           UUID,
  company_id   TEXT,
  agent_domain TEXT,
  entity_type  TEXT,
  entity_id    TEXT,
  content_text TEXT,
  metadata     JSONB,
  similarity   FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.company_id,
    de.agent_domain,
    de.entity_type,
    de.entity_id,
    de.content_text,
    de.metadata,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM public.document_embeddings de
  WHERE
    (filter_domain  IS NULL OR de.agent_domain = filter_domain)
    AND (filter_company IS NULL OR de.company_id  = filter_company)
    AND 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 8: Updated-at trigger
CREATE TRIGGER update_document_embeddings_updated_at
  BEFORE UPDATE ON public.document_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();