
-- Add Odoo-specific columns to quotes table
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS salesperson text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS odoo_id integer UNIQUE;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS odoo_status text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS company_id uuid;

-- Make customer_id nullable for Odoo quotes that may not match a customer
ALTER TABLE public.quotes ALTER COLUMN customer_id DROP NOT NULL;
