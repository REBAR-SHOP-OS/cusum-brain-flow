-- Add metadata and customer_email to sales_invoices
ALTER TABLE public.sales_invoices
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.sales_invoices
ADD COLUMN IF NOT EXISTS customer_email text;

-- Add customer_email to sales_quotations
ALTER TABLE public.sales_quotations
ADD COLUMN IF NOT EXISTS customer_email text;