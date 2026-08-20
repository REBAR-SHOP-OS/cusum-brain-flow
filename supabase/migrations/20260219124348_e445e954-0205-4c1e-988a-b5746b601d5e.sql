
ALTER TABLE public.bank_feed_balances
  ADD COLUMN IF NOT EXISTS unaccepted_count integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unreconciled_count integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reconciled_through date DEFAULT NULL;
