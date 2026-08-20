-- Fix PUBLIC_DATA_EXPOSURE: Restrict integration_settings to admin-only access
-- This table stores sensitive API credentials (OAuth tokens, API keys) that should not be readable by all staff

-- Drop all existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can read integration_settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Authenticated users can insert integration_settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Authenticated users can update integration_settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Authenticated users can delete integration_settings" ON public.integration_settings;

-- Create new admin-only policies
CREATE POLICY "Admin can read integration_settings"
ON public.integration_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert integration_settings"
ON public.integration_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update integration_settings"
ON public.integration_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete integration_settings"
ON public.integration_settings FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));