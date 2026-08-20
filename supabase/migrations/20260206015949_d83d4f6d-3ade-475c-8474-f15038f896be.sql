-- Fix RLS policies to require authentication instead of public access

-- Drop and recreate contacts policies
DROP POLICY IF EXISTS "Allow read access to contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow insert access to contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow update access to contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow delete access to contacts" ON public.contacts;

CREATE POLICY "Authenticated users can read contacts"
ON public.contacts FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert contacts"
ON public.contacts FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update contacts"
ON public.contacts FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete contacts"
ON public.contacts FOR DELETE
USING (auth.role() = 'authenticated');

-- Drop and recreate communications policies
DROP POLICY IF EXISTS "Allow read access to communications" ON public.communications;
DROP POLICY IF EXISTS "Allow insert access to communications" ON public.communications;
DROP POLICY IF EXISTS "Allow update access to communications" ON public.communications;
DROP POLICY IF EXISTS "Allow delete access to communications" ON public.communications;

CREATE POLICY "Authenticated users can read communications"
ON public.communications FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert communications"
ON public.communications FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update communications"
ON public.communications FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete communications"
ON public.communications FOR DELETE
USING (auth.role() = 'authenticated');

-- Drop and recreate delivery_stops policies
DROP POLICY IF EXISTS "Allow read access to delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Allow insert access to delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Allow update access to delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Allow delete access to delivery_stops" ON public.delivery_stops;

CREATE POLICY "Authenticated users can read delivery_stops"
ON public.delivery_stops FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert delivery_stops"
ON public.delivery_stops FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update delivery_stops"
ON public.delivery_stops FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete delivery_stops"
ON public.delivery_stops FOR DELETE
USING (auth.role() = 'authenticated');