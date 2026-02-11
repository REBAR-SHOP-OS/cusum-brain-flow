
-- Add AI relay pipeline columns to communications table
ALTER TABLE public.communications
ADD COLUMN IF NOT EXISTS ai_category text,
ADD COLUMN IF NOT EXISTS ai_urgency text,
ADD COLUMN IF NOT EXISTS ai_action_required boolean,
ADD COLUMN IF NOT EXISTS ai_action_summary text,
ADD COLUMN IF NOT EXISTS ai_draft text,
ADD COLUMN IF NOT EXISTS ai_processed_at timestamptz,
ADD COLUMN IF NOT EXISTS ai_priority_data jsonb,
ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
ADD COLUMN IF NOT EXISTS resolved_summary text;

-- Index for finding unprocessed emails
CREATE INDEX IF NOT EXISTS idx_communications_ai_unprocessed
ON public.communications (ai_processed_at)
WHERE ai_processed_at IS NULL AND direction = 'inbound';
