
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS merged_into_customer_id uuid REFERENCES public.customers(id),
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by text,
  ADD COLUMN IF NOT EXISTS merge_reason text;
