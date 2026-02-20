
-- Fix overly permissive service role policies — restrict writes to service role only
DROP POLICY IF EXISTS "Service role full access qb_classes" ON public.qb_classes;
DROP POLICY IF EXISTS "Service role full access qb_departments" ON public.qb_departments;
DROP POLICY IF EXISTS "Service role full access qb_webhook_events" ON public.qb_webhook_events;

-- These tables are written exclusively by edge functions (service_role), 
-- so INSERT/UPDATE/DELETE are not needed for anon/authenticated users.
-- The SELECT policies already restrict to user's company.
