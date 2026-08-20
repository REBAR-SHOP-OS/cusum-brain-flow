-- Add unique constraint on odoo_message_id for upsert dedup
DROP INDEX IF EXISTS idx_lead_activities_odoo_msg;
CREATE UNIQUE INDEX idx_lead_activities_odoo_msg ON public.lead_activities (odoo_message_id) WHERE odoo_message_id IS NOT NULL;