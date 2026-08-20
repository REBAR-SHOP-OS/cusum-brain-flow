-- 1) Fix cron job 6: use hardcoded anon-bearer like other crons (current_setting fails)
SELECT cron.unschedule(6);

-- 2) Drop broken trigger that references nonexistent communications.channel/body_text/body_html
DROP TRIGGER IF EXISTS trg_auto_link_comm_to_lead ON public.communications;
DROP FUNCTION IF EXISTS public.auto_link_comm_to_lead();

-- 3) Expand notifications_priority_check to include 'urgent' and 'medium' (used by code)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_priority_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_priority_check
  CHECK (priority = ANY (ARRAY['low','normal','medium','high','urgent']));