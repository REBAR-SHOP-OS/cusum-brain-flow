
-- Add unique constraint for upsert support on document_embeddings
CREATE UNIQUE INDEX idx_embeddings_unique_entity 
  ON public.document_embeddings(agent_domain, entity_type, entity_id)
  WHERE entity_id IS NOT NULL;
