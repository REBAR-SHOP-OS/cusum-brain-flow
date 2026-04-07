SELECT vault.update_secret(
  '0e901161-5763-44fe-a992-041b6b086c48'::uuid,
  'internal-secret-2026-cusum',
  'INTERNAL_FUNCTION_SECRET',
  'Shared secret for internal cron/system edge functions'
);