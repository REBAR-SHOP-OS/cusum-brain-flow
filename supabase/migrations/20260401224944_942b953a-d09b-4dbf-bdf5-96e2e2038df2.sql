-- Helper function to retrieve the internal function secret from vault
CREATE OR REPLACE FUNCTION public.get_internal_function_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET' LIMIT 1),
    ''
  );
$$;

-- Revoke public access — only used internally by trigger functions
REVOKE ALL ON FUNCTION public.get_internal_function_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_internal_function_secret() FROM anon;
REVOKE ALL ON FUNCTION public.get_internal_function_secret() FROM authenticated;

-- 1. Update notify_on_team_message
CREATE OR REPLACE FUNCTION public.notify_on_team_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdnp6aWlnZm5xcGZka2N6YmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzA5MDYsImV4cCI6MjA4NTkwNjkwNn0.PPat1nPMvVVGu2hqihmS4pdJ73sBiRw5xdv8AkqNT9M',
      'x-internal-secret', get_internal_function_secret()
    )
  );
  RETURN NEW;
END;
$function$;

-- 2. Update notify_on_support_message
CREATE OR REPLACE FUNCTION public.notify_on_support_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdnp6aWlnZm5xcGZka2N6YmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzA5MDYsImV4cCI6MjA4NTkwNjkwNn0.PPat1nPMvVVGu2hqihmS4pdJ73sBiRw5xdv8AkqNT9M',
      'x-internal-secret', get_internal_function_secret()
    )
  );
  RETURN NEW;
END;
$function$;

-- 3. Update push_on_notification_insert
CREATE OR REPLACE FUNCTION public.push_on_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdnp6aWlnZm5xcGZka2N6YmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzA5MDYsImV4cCI6MjA4NTkwNjkwNn0.PPat1nPMvVVGu2hqihmS4pdJ73sBiRw5xdv8AkqNT9M',
      'x-internal-secret', get_internal_function_secret()
    )
  );
  RETURN NEW;
END;
$function$;

-- 4. Update notify_feedback_owner_on_resolve
CREATE OR REPLACE FUNCTION public.notify_feedback_owner_on_resolve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
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
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdnp6aWlnZm5xcGZka2N6YmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzA5MDYsImV4cCI6MjA4NTkwNjkwNn0.PPat1nPMvVVGu2hqihmS4pdJ73sBiRw5xdv8AkqNT9M',
      'x-internal-secret', get_internal_function_secret()
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;