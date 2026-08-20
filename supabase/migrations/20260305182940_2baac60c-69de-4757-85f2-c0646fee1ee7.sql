
-- Fix: dedup scheduled_activities and recreate unique index
-- This migration handles duplicates that block the unique index

-- Step 1: Drop the index if it exists (from prior partial runs)
DROP INDEX IF EXISTS idx_scheduled_activities_dedup;

-- Step 2: Deduplicate all rows matching the index key
DELETE FROM public.scheduled_activities WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY entity_id, activity_type, summary, due_date
      ORDER BY created_at DESC, id DESC
    ) AS rn FROM public.scheduled_activities
    WHERE entity_type = 'lead'
  ) t WHERE rn > 1
);

-- Step 3: Create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_activities_dedup
ON public.scheduled_activities (entity_id, activity_type, summary, due_date)
WHERE entity_type = 'lead';
