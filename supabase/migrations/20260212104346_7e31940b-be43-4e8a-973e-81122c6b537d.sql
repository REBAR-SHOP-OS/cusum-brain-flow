
-- Fix: set the events backward-compat view to SECURITY INVOKER
ALTER VIEW public.events SET (security_invoker = on);
