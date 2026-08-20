CREATE OR REPLACE FUNCTION public.notify_human_task()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _assigned_user_id uuid;
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    SELECT user_id INTO _assigned_user_id FROM public.profiles WHERE id = NEW.assigned_to;
    IF _assigned_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, description, priority, link_to, agent_name, status, metadata)
      VALUES (
        _assigned_user_id, 'todo',
        '🔔 ' || NEW.title,
        COALESCE(NEW.description, ''),
        CASE WHEN NEW.severity = 'critical' THEN 'high' ELSE 'normal' END,
        '/tasks',
        'AI Agent',
        'unread',
        jsonb_build_object('human_task_id', NEW.id, 'severity', NEW.severity, 'category', NEW.category)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;