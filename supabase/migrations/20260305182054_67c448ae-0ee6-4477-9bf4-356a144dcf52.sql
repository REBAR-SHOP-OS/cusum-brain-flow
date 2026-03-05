-- Ensure dedup before unique index (fixes publish blocker)
-- First delete duplicates for the specific key that's failing
DELETE FROM public.scheduled_activities WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY entity_id, activity_type, summary, due_date
      ORDER BY created_at DESC, id DESC
    ) AS rn FROM public.scheduled_activities
    WHERE entity_type = 'lead'
  ) t WHERE rn > 1
);

-- Recreate the index idempotently (in case it was partially created)
DROP INDEX IF EXISTS idx_scheduled_activities_dedup;
CREATE UNIQUE INDEX idx_scheduled_activities_dedup 
ON public.scheduled_activities (entity_id, activity_type, summary, due_date)
WHERE entity_type = 'lead';