
-- Fix: Replace the overly permissive ALL policy with a restrictive one
-- The service role bypasses RLS anyway, so we only need the SELECT policy for authenticated users
DROP POLICY "Service role full access on wc_qb_order_map" ON public.wc_qb_order_map;
