
-- Fix overly permissive SELECT policies on comms_agent_pairing
DROP POLICY IF EXISTS "Authenticated users can read pairings" ON public.comms_agent_pairing;
CREATE POLICY "Users can read own company pairings" ON public.comms_agent_pairing
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- Fix overly permissive SELECT policies on comms_alerts
DROP POLICY IF EXISTS "Authenticated users can read alerts" ON public.comms_alerts;
CREATE POLICY "Users can read own company alerts" ON public.comms_alerts
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- Fix overly permissive SELECT policies on comms_config
DROP POLICY IF EXISTS "Authenticated users can read config" ON public.comms_config;
CREATE POLICY "Users can read own company config" ON public.comms_config
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
