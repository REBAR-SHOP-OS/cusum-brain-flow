-- Trigger to auto-translate notifications for non-English users
-- Calls the translate-notification edge function via net.http_post after INSERT
CREATE OR REPLACE FUNCTION public.translate_notification_trigger()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/translate-notification',
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'title', NEW.title,
        'description', NEW.description
      )
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdnp6aWlnZm5xcGZka2N6YmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzA5MDYsImV4cCI6MjA4NTkwNjkwNn0.PPat1nPMvVVGu2hqihmS4pdJ73sBiRw5xdv8AkqNT9M'
    )
  );
  RETURN NEW;
END;
$function$;

-- Create the trigger on notifications table
CREATE TRIGGER translate_notification_on_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.translate_notification_trigger();
