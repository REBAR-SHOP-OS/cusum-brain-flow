UPDATE time_clock_entries
SET clock_out = date_trunc('day', clock_in) + interval '18 hours',
    notes = '[auto-closed: stale shift fixed by admin]'
WHERE clock_out IS NULL
  AND clock_in < now() - interval '12 hours';