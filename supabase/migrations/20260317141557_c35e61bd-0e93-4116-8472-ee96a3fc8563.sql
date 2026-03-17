-- Index to speed up file linkage repair queries
CREATE INDEX IF NOT EXISTS idx_lead_files_odoo_id_unlinked ON lead_files(odoo_id) WHERE odoo_message_id IS NULL AND odoo_id IS NOT NULL;

-- Index for chatter sync lookups by lead_id + source
CREATE INDEX IF NOT EXISTS idx_lead_files_lead_source ON lead_files(lead_id, source) WHERE source = 'odoo_sync';