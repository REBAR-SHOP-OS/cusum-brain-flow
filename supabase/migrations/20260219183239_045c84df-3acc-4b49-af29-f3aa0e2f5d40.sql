
-- Replace old PL/pgSQL trigger with a net.http_post webhook that calls the new edge function
-- First drop the old trigger and function
DROP TRIGGER IF EXISTS trg_notify_feedback_owner ON public.tasks;
DROP FUNCTION IF EXISTS public.notify_feedback_owner_on_resolve();

-- Create new trigger function that POSTs to the notify-feedback-owner edge function
CREATE OR REPLACE FUNCTION public.notify_feedback_owner_on_resolve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when a screenshot_feedback task transitions to 'resolved'
  IF NEW.source = 'screenshot_feedback'
     AND NEW.status = 'resolved'
     AND (OLD.status IS DISTINCT FROM 'resolved') THEN
    PERFORM net.http_post(
      url := 'https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/notify-feedback-owner',
      body := jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'title', NEW.title,
          'status', NEW.status,
          'source', NEW.source,
          'created_by_profile_id', NEW.created_by_profile_id
        )
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdnp6aWlnZm5xcGZka2N6YmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzA5MDYsImV4cCI6MjA4NTkwNjkwNn0.PPat1nPMvVVGu2hqihmS4pdJ73sBiRw5xdv8AkqNT9M'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trg_notify_feedback_owner
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_feedback_owner_on_resolve();
