
-- Add invoice_number and invoice_date columns to extract_sessions
ALTER TABLE public.extract_sessions
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_date date;
