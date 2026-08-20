
CREATE OR REPLACE FUNCTION public.update_cron_auth_key(_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE cron.job 
  SET command = format(
    E'\n    SELECT net.http_post(\n      url := ''https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/odoo-crm-sync'',\n      headers := jsonb_build_object(\n        ''Content-Type'', ''application/json'',\n        ''Authorization'', ''Bearer %s''\n      ),\n      body := ''{"mode":"incremental"}''::jsonb\n    ) AS request_id;\n  ', _key)
  WHERE jobid = 4;

  UPDATE cron.job 
  SET command = format(
    E'\n    SELECT net.http_post(\n      url := ''https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/odoo-chatter-sync'',\n      headers := jsonb_build_object(\n        ''Content-Type'', ''application/json'',\n        ''Authorization'', ''Bearer %s''\n      ),\n      body := ''{"mode":"missing"}''::jsonb\n    ) AS request_id;\n  ', _key)
  WHERE jobid = 5;
END;
$$;
