
-- Create lead_files table for storing Odoo attachments/files
CREATE TABLE public.lead_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  odoo_id INTEGER,
  storage_path TEXT,
  source TEXT DEFAULT 'odoo_sync',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_files ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view lead files in their company"
  ON public.lead_files FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert lead files in their company"
  ON public.lead_files FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete lead files in their company"
  ON public.lead_files FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Indexes
CREATE INDEX idx_lead_files_lead_id ON public.lead_files(lead_id);
CREATE INDEX idx_lead_files_odoo_id ON public.lead_files(odoo_id);

-- Add odoo_message_id to lead_activities to prevent duplicate chatter messages
ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS odoo_message_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_lead_activities_odoo_msg ON public.lead_activities(odoo_message_id) WHERE odoo_message_id IS NOT NULL;
