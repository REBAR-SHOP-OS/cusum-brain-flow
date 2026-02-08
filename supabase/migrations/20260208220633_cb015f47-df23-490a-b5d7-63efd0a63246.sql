
-- Add unique constraint on accounting_mirror for QuickBooks entity upserts
ALTER TABLE public.accounting_mirror ADD CONSTRAINT accounting_mirror_quickbooks_id_unique UNIQUE (quickbooks_id);
