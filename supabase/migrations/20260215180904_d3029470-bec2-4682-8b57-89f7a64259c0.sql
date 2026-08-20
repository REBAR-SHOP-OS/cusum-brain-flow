-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: fires on team_messages INSERT, calls notify-on-message edge function
CREATE OR REPLACE FUNCTION public.notify_on_team_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _service_key := current_setting('app.settings.service_role_key', true);

  -- Use pg_net to POST to the edge function
  PERFORM extensions.http_post(
    url := 'https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/notify-on-message',
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'team_messages',
      'record', jsonb_build_object(
        'id', NEW.id,
        'channel_id', NEW.channel_id,
        'sender_profile_id', NEW.sender_profile_id,
        'original_text', NEW.original_text,
        'created_at', NEW.created_at
      )
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdnp6aWlnZm5xcGZka2N6YmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzA5MDYsImV4cCI6MjA4NTkwNjkwNn0.PPat1nPMvVVGu2hqihmS4pdJ73sBiRw5xdv8AkqNT9M'
    )
  );
  RETURN NEW;
END;
$$;

-- Trigger function: fires on support_messages INSERT (visitor only), calls notify-on-message
CREATE OR REPLACE FUNCTION public.notify_on_support_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire for visitor messages that are not internal notes or system
  IF NEW.sender_type != 'visitor' OR NEW.is_internal_note = true OR NEW.content_type = 'system' THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := 'https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/notify-on-message',
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'support_messages',
      'record', jsonb_build_object(
        'id', NEW.id,
        'conversation_id', NEW.conversation_id,
        'sender_type', NEW.sender_type,
        'sender_id', NEW.sender_id,
        'content', NEW.content,
        'content_type', NEW.content_type,
        'is_internal_note', NEW.is_internal_note,
        'created_at', NEW.created_at
      )
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdnp6aWlnZm5xcGZka2N6YmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzA5MDYsImV4cCI6MjA4NTkwNjkwNn0.PPat1nPMvVVGu2hqihmS4pdJ73sBiRw5xdv8AkqNT9M'
    )
  );
  RETURN NEW;
END;
$$;

-- Attach triggers
CREATE TRIGGER on_team_message_inserted
  AFTER INSERT ON public.team_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_team_message();

CREATE TRIGGER on_support_message_inserted
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_support_message();
