-- Drop the remaining "Authenticated users full access" policies that still use true
DROP POLICY IF EXISTS "Authenticated users full access" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.communications;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.delivery_stops;