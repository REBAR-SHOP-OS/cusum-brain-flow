-- Fix match_documents function: drop with CASCADE then recreate to avoid return type conflict
DROP FUNCTION IF EXISTS public.match_documents(vector, integer, double precision, text, text) CASCADE;

CREATE OR REPLACE FUNCTION public.match_documents(
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