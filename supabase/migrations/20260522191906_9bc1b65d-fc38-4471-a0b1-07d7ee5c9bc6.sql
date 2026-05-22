UPDATE public.comms_alerts
SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{dropped_external}', 'true')
WHERE owner_email !~* '@rebar\.shop'
  AND owner_email <> ''
  AND created_at > now() - interval '7 days';