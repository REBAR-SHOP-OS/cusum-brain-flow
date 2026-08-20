SELECT vault.update_secret(
  '0e901161-5763-44fe-a992-041b6b086c48'::uuid,
  'ifs_a7b3c9d1e5f2g8h4j6k0m3n7p9q2r5s1t8u4v6w0x3y7z',
  'INTERNAL_FUNCTION_SECRET',
  'Shared secret for internal cron/system edge functions'
);