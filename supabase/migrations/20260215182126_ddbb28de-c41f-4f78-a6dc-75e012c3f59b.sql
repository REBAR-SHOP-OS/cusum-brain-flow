
-- Fix: use net.http_post (pg_net) instead of extensions.http_post

CREATE OR REPLACE FUNCTION public.notify_on_team_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM net.http_post(
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
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdnp6aWlnZm5xcGZka2N6YmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzA5MDYsImV4cCI6MjA4NTkwNjkwNn0.PPat1nPMvVVGu2hqihmS4pdJ73sBiRw5xdv8AkqNT9M'
    )
  );
  RETURN NEW;
END;
$function$;

-- Also fix notify_on_support_message which has the same issue
CREATE OR REPLACE FUNCTION public.notify_on_support_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.sender_type != 'visitor' OR NEW.is_internal_note = true OR NEW.content_type = 'system' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
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
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdnp6aWlnZm5xcGZka2N6YmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzA5MDYsImV4cCI6MjA4NTkwNjkwNn0.PPat1nPMvVVGu2hqihmS4pdJ73sBiRw5xdv8AkqNT9M'
    )
  );
  RETURN NEW;
END;
$function$;

-- Fix push_on_notification_insert too
CREATE OR REPLACE FUNCTION public.push_on_notification_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/push-on-notify',
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'record', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'title', NEW.title,
        'description', NEW.description,
        'link_to', NEW.link_to,
        'priority', NEW.priority,
        'metadata', NEW.metadata
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
