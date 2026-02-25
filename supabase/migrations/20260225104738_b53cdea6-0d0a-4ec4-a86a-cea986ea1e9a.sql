
SELECT cron.alter_job(
  4,
  command := $cronCmd$
    SELECT net.http_post(
      url := 'https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/odoo-crm-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_secret_awjjbBcZsNcBcUjnog9g5Q_BJkWbAlM'
      ),
      body := '{"mode":"incremental"}'::jsonb
    ) AS request_id;
  $cronCmd$
);

SELECT cron.alter_job(
  5,
  command := $cronCmd$
    SELECT net.http_post(
      url := 'https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/odoo-chatter-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_secret_awjjbBcZsNcBcUjnog9g5Q_BJkWbAlM'
      ),
      body := '{"mode":"missing"}'::jsonb
    ) AS request_id;
  $cronCmd$
);

DROP FUNCTION IF EXISTS public.update_cron_auth_key(text);
