ALTER TABLE leads ADD COLUMN IF NOT EXISTS odoo_created_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS odoo_updated_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_touched_at timestamptz;