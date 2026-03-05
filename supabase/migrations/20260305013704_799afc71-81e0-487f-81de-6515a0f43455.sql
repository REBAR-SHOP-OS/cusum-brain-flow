ALTER TABLE public.lead_files ADD COLUMN odoo_message_id integer;
CREATE INDEX idx_lead_files_odoo_message_id ON public.lead_files (odoo_message_id);