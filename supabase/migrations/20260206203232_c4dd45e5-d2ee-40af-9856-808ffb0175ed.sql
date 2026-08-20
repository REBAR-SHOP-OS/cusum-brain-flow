-- Add unique constraint on quickbooks_id for upsert to work
CREATE UNIQUE INDEX customers_quickbooks_id_unique ON public.customers (quickbooks_id) WHERE quickbooks_id IS NOT NULL;