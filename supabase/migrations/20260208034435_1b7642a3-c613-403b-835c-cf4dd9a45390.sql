
-- Add source_email_id to leads to track which Gmail email created the lead (prevents duplicates)
ALTER TABLE public.leads ADD COLUMN source_email_id text UNIQUE;

-- Add index for fast lookups during deduplication
CREATE INDEX idx_leads_source_email_id ON public.leads (source_email_id) WHERE source_email_id IS NOT NULL;
