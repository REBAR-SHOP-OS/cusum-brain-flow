
-- Drop dependent objects with CASCADE then recreate
DROP FUNCTION IF EXISTS public.match_documents CASCADE;
DROP TABLE IF EXISTS public.document_embeddings CASCADE;
DROP EXTENSION IF EXISTS vector CASCADE;

-- Recreate the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Recreate the document_embeddings table
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can read embeddings"
  ON public.document_embeddings FOR SELECT
  USING (true);

-- Recreate match_documents function
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(768),
  match_count int DEFAULT 5,
  filter_company_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.content,
    de.metadata,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM public.document_embeddings de
  WHERE (filter_company_id IS NULL OR de.company_id = filter_company_id)
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
