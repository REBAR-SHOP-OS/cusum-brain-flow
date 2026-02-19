
CREATE OR REPLACE FUNCTION public.notify_feedback_owner_on_resolve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _owner_user_id uuid;
BEGIN
  IF NEW.source = 'screenshot_feedback'
     AND NEW.status = 'resolved'
     AND (OLD.status IS DISTINCT FROM 'resolved')
     AND NEW.created_by_profile_id IS NOT NULL THEN

    SELECT user_id INTO _owner_user_id
    FROM public.profiles WHERE id = NEW.created_by_profile_id;

    IF _owner_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id, type, title, description, priority,
        link_to, agent_name, status, metadata
      ) VALUES (
        _owner_user_id,
        'todo',
        'Verify fix: ' || LEFT(NEW.title, 80),
        'Your screenshot feedback has been marked as resolved. Please verify the fix is correct.',
        'high',
        '/tasks',
        'Feedback',
        'unread',
        jsonb_build_object(
          'task_id', NEW.id,
          'screenshot_url', NEW.attachment_url,
          'action', 'verify_fix'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_feedback_owner
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_feedback_owner_on_resolve();
