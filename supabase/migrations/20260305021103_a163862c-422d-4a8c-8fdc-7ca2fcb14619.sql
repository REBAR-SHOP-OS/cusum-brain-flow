ALTER TABLE public.lead_files ADD COLUMN IF NOT EXISTS odoo_message_id integer;
CREATE INDEX IF NOT EXISTS idx_lead_files_odoo_message_id ON public.lead_files(odoo_message_id);