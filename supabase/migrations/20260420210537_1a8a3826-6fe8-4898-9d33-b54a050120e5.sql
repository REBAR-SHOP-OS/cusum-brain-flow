-- 1) Enum for fulfillment channel
DO $$ BEGIN
  CREATE TYPE public.fulfillment_channel AS ENUM ('pickup','loading','delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Columns on cut_plan_items
ALTER TABLE public.cut_plan_items
  ADD COLUMN IF NOT EXISTS fulfillment_channel public.fulfillment_channel,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_id uuid,
  ADD COLUMN IF NOT EXISTS loading_list_id uuid,
  ADD COLUMN IF NOT EXISTS pickup_id uuid;

-- 3) Default channel on projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS default_fulfillment_channel public.fulfillment_channel NOT NULL DEFAULT 'pickup';

-- 4) Extended trigger function — preserves all existing logic, only adds completion staging
CREATE OR REPLACE FUNCTION public.auto_advance_item_phase()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_default public.fulfillment_channel;
BEGIN
  -- Cutting complete → advance to cut_done (bend) or clearance (straight)
  IF NEW.completed_pieces >= NEW.total_pieces
     AND NEW.total_pieces > 0
     AND NEW.phase IN ('queued', 'cutting') THEN
    IF NEW.bend_type = 'bend' THEN
      NEW.phase := 'cut_done';
    ELSE
      NEW.phase := 'clearance';
    END IF;
  END IF;

  -- Bending complete → advance to clearance
  IF NEW.bend_completed_pieces >= NEW.total_pieces
     AND NEW.total_pieces > 0
     AND NEW.phase IN ('bending', 'cut_done') THEN
    NEW.phase := 'clearance';
  END IF;

  -- NEW: Transition into 'complete' → auto-stage into a fulfillment channel
  IF NEW.phase = 'complete'
     AND (TG_OP = 'INSERT' OR OLD.phase IS DISTINCT FROM 'complete') THEN
    IF NEW.fulfillment_channel IS NULL THEN
      SELECT p.default_fulfillment_channel INTO v_default
      FROM public.cut_plans cp
      JOIN public.projects p ON p.id = cp.project_id
      WHERE cp.id = NEW.cut_plan_id;
      NEW.fulfillment_channel := COALESCE(v_default, 'pickup'::public.fulfillment_channel);
    END IF;
    IF NEW.ready_at IS NULL THEN
      NEW.ready_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 5) Backfill existing completed items so they appear immediately
UPDATE public.cut_plan_items
SET fulfillment_channel = 'pickup'::public.fulfillment_channel,
    ready_at = COALESCE(ready_at, now())
WHERE phase = 'complete' AND fulfillment_channel IS NULL;

-- 6) Helpful index for board queries
CREATE INDEX IF NOT EXISTS idx_cut_plan_items_ready
  ON public.cut_plan_items (fulfillment_channel, ready_at DESC)
  WHERE phase = 'complete' AND delivery_id IS NULL AND loading_list_id IS NULL AND pickup_id IS NULL;