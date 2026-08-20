-- Drop duplicate RLS policies on activity_events (old renamed policies)
DROP POLICY IF EXISTS "Staff read events in company" ON public.activity_events;
DROP POLICY IF EXISTS "Staff insert events in company" ON public.activity_events;
DROP POLICY IF EXISTS "Staff update events in company" ON public.activity_events;
DROP POLICY IF EXISTS "Admins delete events in company" ON public.activity_events;