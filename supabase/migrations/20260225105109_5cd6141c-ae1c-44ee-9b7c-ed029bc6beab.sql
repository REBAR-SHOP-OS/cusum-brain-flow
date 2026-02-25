SELECT cron.alter_job(
  3,
  command := $cronCmd$
    SELECT net.http_post(
      url := 'https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/check-sla-breaches',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_secret_awjjbBcZsNcBcUjnog9g5Q_BJkWbAlM'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $cronCmd$
);