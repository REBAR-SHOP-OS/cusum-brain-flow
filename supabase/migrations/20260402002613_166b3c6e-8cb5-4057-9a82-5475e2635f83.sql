-- Remove duplicate ringcentral-sync cron jobs (keep job 25 as the primary)
SELECT cron.unschedule('ringcentral-sync-every-15min');
SELECT cron.unschedule('ringcentral-sync-cron');

-- Reschedule job 25 to every 15 minutes (was 5min, too aggressive)
SELECT cron.unschedule('ringcentral-cron-sync');

SELECT cron.schedule(
  'ringcentral-cron-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/ringcentral-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdnp6aWlnZm5xcGZka2N6YmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzA5MDYsImV4cCI6MjA4NTkwNjkwNn0.PPat1nPMvVVGu2hqihmS4pdJ73sBiRw5xdv8AkqNT9M"}'::jsonb,
    body := '{"mode": "cron", "syncType": "all", "daysBack": 1}'::jsonb
  ) AS request_id;
  $$
);