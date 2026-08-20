
-- Add source_type to ingestion_progress for separate XLS/PDF/job_log tracking
ALTER TABLE public.ingestion_progress ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'xls';

-- Add index on lead_files for faster queries
CREATE INDEX IF NOT EXISTS idx_lead_files_lead_id_file_name ON public.lead_files (lead_id, file_name);

-- Add index on lead_files for mime_type filtering
CREATE INDEX IF NOT EXISTS idx_lead_files_mime_type ON public.lead_files (mime_type);

-- Drop unique constraint on job_type+company_id if it exists, since we now have source_type
-- We need to allow multiple rows per company (barlists_xls, barlists_pdf, job_logs)
DO $$
BEGIN
  -- Check and drop any unique constraint on (job_type, company_id)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.ingestion_progress'::regclass 
    AND contype = 'u'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.ingestion_progress DROP CONSTRAINT ' || conname
      FROM pg_constraint 
      WHERE conrelid = 'public.ingestion_progress'::regclass 
      AND contype = 'u'
      LIMIT 1
    );
  END IF;
END $$;

-- Add processed files counter
ALTER TABLE public.ingestion_progress ADD COLUMN IF NOT EXISTS processed_files integer DEFAULT 0;
ALTER TABLE public.ingestion_progress ADD COLUMN IF NOT EXISTS total_files integer DEFAULT 0;
