
-- 0a) Remove legacy auto-completer that jumps to 'completed' out of adjacency.
DROP TRIGGER IF EXISTS trg_auto_complete_cut_plan ON public.cut_plan_items;
DROP FUNCTION IF EXISTS public.auto_complete_cut_plan() CASCADE;

-- 0b) Remove legacy status validator + old CHECK (in case prior tx rolled back).
DROP TRIGGER IF EXISTS validate_cut_plan_status_trigger ON public.cut_plans;
DROP TRIGGER IF EXISTS trg_validate_cut_plan_status     ON public.cut_plans;
DROP TRIGGER IF EXISTS validate_cut_plan_status         ON public.cut_plans;
DROP FUNCTION IF EXISTS public.validate_cut_plan_status() CASCADE;
ALTER TABLE public.cut_plans DROP CONSTRAINT IF EXISTS cut_plans_status_check;

-- 1) Item-phase auto-advance: only adjacency-valid targets.
CREATE OR REPLACE FUNCTION public.auto_advance_item_phase()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.completed_pieces >= NEW.total_pieces
     AND NEW.total_pieces > 0
     AND NEW.phase IN ('queued','cutting') THEN
    IF NEW.bend_type = 'bend' THEN
      NEW.phase := 'cut_done';
    ELSE
      NEW.phase := 'clearance';
    END IF;
  END IF;

  IF NEW.bend_completed_pieces >= NEW.total_pieces
     AND NEW.total_pieces > 0
     AND NEW.phase IN ('bending','cut_done','bent') THEN
    NEW.phase := 'clearance';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Adjacency hop helper for cut_plans.
CREATE OR REPLACE FUNCTION public._cut_plan_next_hop(_current text, _target text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE rank_current int; rank_target int;
BEGIN
  IF _current = _target THEN RETURN NULL; END IF;

  rank_current := CASE _current
    WHEN 'draft' THEN 0 WHEN 'planning' THEN 1 WHEN 'queued' THEN 2
    WHEN 'in_production' THEN 3 WHEN 'ready_for_clearance' THEN 4
    WHEN 'cleared' THEN 5 WHEN 'ready_for_release' THEN 6
    WHEN 'released' THEN 7 WHEN 'ready_for_delivery' THEN 8
    WHEN 'driver_assigned' THEN 9 WHEN 'in_transit' THEN 10
    WHEN 'delivered' THEN 11 WHEN 'completed' THEN 12
    ELSE -1 END;
  rank_target := CASE _target
    WHEN 'draft' THEN 0 WHEN 'planning' THEN 1 WHEN 'queued' THEN 2
    WHEN 'in_production' THEN 3 WHEN 'ready_for_clearance' THEN 4
    WHEN 'cleared' THEN 5 WHEN 'ready_for_release' THEN 6
    WHEN 'released' THEN 7 WHEN 'ready_for_delivery' THEN 8
    WHEN 'driver_assigned' THEN 9 WHEN 'in_transit' THEN 10
    WHEN 'delivered' THEN 11 WHEN 'completed' THEN 12
    ELSE -1 END;

  IF rank_current < 0 OR rank_target < 0 OR rank_target <= rank_current THEN
    RETURN NULL;
  END IF;

  RETURN CASE _current
    WHEN 'draft'               THEN 'queued'
    WHEN 'planning'            THEN 'queued'
    WHEN 'queued'              THEN 'in_production'
    WHEN 'in_production'       THEN 'ready_for_clearance'
    WHEN 'ready_for_clearance' THEN 'cleared'
    WHEN 'cleared'             THEN 'ready_for_release'
    WHEN 'ready_for_release'   THEN 'released'
    WHEN 'released'            THEN 'ready_for_delivery'
    WHEN 'ready_for_delivery'  THEN 'driver_assigned'
    WHEN 'driver_assigned'     THEN 'in_transit'
    WHEN 'in_transit'          THEN 'delivered'
    WHEN 'delivered'           THEN 'completed'
    ELSE NULL
  END;
END;
$$;

-- 3) Plan-status auto-advance: walker, canonical-only, never auto-completes.
CREATE OR REPLACE FUNCTION public.auto_advance_plan_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_total int;
  v_past_queued int;
  v_cut_or_beyond int;
  v_clearance_or_beyond int;
  v_current text;
  v_target text;
  v_next text;
  v_guard int := 0;
BEGIN
  v_plan_id := COALESCE(NEW.cut_plan_id, OLD.cut_plan_id);
  IF v_plan_id IS NULL THEN RETURN NEW; END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE phase NOT IN ('queued')),
    COUNT(*) FILTER (WHERE phase IN (
      'cut_done','bent','clearance','cleared','zoned',
      'loading','loaded','ready_for_pickup','picked_up',
      'ready_for_delivery','driver_assigned','in_transit','delivered',
      'complete','closed'
    )),
    COUNT(*) FILTER (WHERE phase IN (
      'clearance','cleared','zoned',
      'loading','loaded','ready_for_pickup','picked_up',
      'ready_for_delivery','driver_assigned','in_transit','delivered',
      'complete','closed'
    ))
  INTO v_total, v_past_queued, v_cut_or_beyond, v_clearance_or_beyond
  FROM public.cut_plan_items
  WHERE cut_plan_id = v_plan_id;

  IF v_total = 0 THEN RETURN NEW; END IF;

  SELECT status INTO v_current FROM public.cut_plans WHERE id = v_plan_id;
  IF v_current IS NULL THEN RETURN NEW; END IF;

  IF v_clearance_or_beyond = v_total THEN
    v_target := 'ready_for_clearance';
  ELSIF v_cut_or_beyond = v_total OR v_past_queued > 0 THEN
    v_target := 'in_production';
  ELSE
    RETURN NEW;
  END IF;

  LOOP
    v_guard := v_guard + 1;
    EXIT WHEN v_guard > 12;
    v_next := public._cut_plan_next_hop(v_current, v_target);
    EXIT WHEN v_next IS NULL;

    UPDATE public.cut_plans
    SET status = v_next, updated_at = now()
    WHERE id = v_plan_id;

    v_current := v_next;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 4) Normalize legacy statuses on existing plans.
UPDATE public.cut_plans SET status = 'in_production' WHERE status IN ('running','cut_done','bend_complete');
UPDATE public.cut_plans SET status = 'archived'      WHERE status = 'canceled';

-- 5) Re-evaluate every plan through the new walker.
DO $$
DECLARE r RECORD; v_item uuid;
BEGIN
  FOR r IN SELECT DISTINCT cut_plan_id FROM public.cut_plan_items WHERE cut_plan_id IS NOT NULL LOOP
    SELECT id INTO v_item FROM public.cut_plan_items WHERE cut_plan_id = r.cut_plan_id LIMIT 1;
    IF v_item IS NOT NULL THEN
      UPDATE public.cut_plan_items SET phase = phase WHERE id = v_item;
    END IF;
  END LOOP;
END $$;
