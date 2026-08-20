ALTER TABLE public.ad_projects REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_projects;