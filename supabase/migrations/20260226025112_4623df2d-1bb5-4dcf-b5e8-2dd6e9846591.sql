
-- Add dedupe_key column for idempotency guards
ALTER TABLE public.qb_transactions ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
CREATE INDEX IF NOT EXISTS idx_qb_transactions_dedupe ON public.qb_transactions(company_id, entity_type, dedupe_key) WHERE dedupe_key IS NOT NULL;
