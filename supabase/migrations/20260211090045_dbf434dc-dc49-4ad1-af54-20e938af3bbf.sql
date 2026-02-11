
-- Drop overly permissive service policies
DROP POLICY "Service can manage interactions" ON public.vizzy_interactions;
DROP POLICY "Service can manage journals" ON public.vizzy_journals;
