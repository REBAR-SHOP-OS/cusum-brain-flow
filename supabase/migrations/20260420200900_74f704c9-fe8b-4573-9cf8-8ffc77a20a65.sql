-- 1) Update the validator function whitelist
CREATE OR REPLACE FUNCTION public.validate_cut_plan_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'queued', 'running', 'cut_done', 'bend_complete', 'completed', 'canceled') THEN
    RAISE EXCEPTION 'Invalid cut_plan status: %. Allowed: draft, queued, running, cut_done, bend_complete, completed, canceled', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Extend the CHECK constraint
ALTER TABLE public.cut_plans DROP CONSTRAINT IF EXISTS cut_plans_status_check;
ALTER TABLE public.cut_plans
  ADD CONSTRAINT cut_plans_status_check
  CHECK (status IN ('draft', 'queued', 'running', 'cut_done', 'bend_complete', 'completed', 'canceled'));

-- 3) Smarter auto-advance trigger
CREATE OR REPLACE FUNCTION public.auto_advance_plan_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_cnt           int;
  v_complete_cnt        int;
  v_bend_or_beyond_cnt  int;
  v_cut_or_beyond_cnt   int;
  v_has_bend            boolean;
  v_new_status          text;
  v_current_status      text;
BEGIN
  IF NEW.cut_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_total_cnt
  FROM public.cut_plan_items
  WHERE cut_plan_id = NEW.cut_plan_id;

  IF v_total_cnt = 0 THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE phase = 'complete'),
    COUNT(*) FILTER (
      WHERE phase IN ('bend_done', 'clearance', 'complete')
         OR (bend_type = 'straight' AND phase = 'complete')
    ),
    COUNT(*) FILTER (
      WHERE phase IN ('cut_done', 'bending', 'bend_done', 'clearance', 'complete')
    ),
    BOOL_OR(bend_type = 'bend')
  INTO v_complete_cnt, v_bend_or_beyond_cnt, v_cut_or_beyond_cnt, v_has_bend
  FROM public.cut_plan_items
  WHERE cut_plan_id = NEW.cut_plan_id;

  IF v_complete_cnt = v_total_cnt THEN
    v_new_status := 'completed';
  ELSIF v_bend_or_beyond_cnt = v_total_cnt AND COALESCE(v_has_bend, false) THEN
    v_new_status := 'bend_complete';
  ELSIF v_cut_or_beyond_cnt = v_total_cnt AND COALESCE(v_has_bend, false) THEN
    v_new_status := 'cut_done';
  ELSIF v_cut_or_beyond_cnt = v_total_cnt AND NOT COALESCE(v_has_bend, false) THEN
    v_new_status := 'completed';
  ELSE
    RETURN NEW;
  END IF;

  SELECT status INTO v_current_status FROM public.cut_plans WHERE id = NEW.cut_plan_id;

  IF v_current_status IS DISTINCT FROM v_new_status
     AND v_current_status NOT IN ('canceled') THEN
    UPDATE public.cut_plans
    SET status = v_new_status,
        updated_at = now()
    WHERE id = NEW.cut_plan_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Backfill: nudge each item to re-fire the trigger and recompute plan statuses
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.cut_plan_items LOOP
    UPDATE public.cut_plan_items SET phase = phase WHERE id = r.id;
  END LOOP;
END $$;