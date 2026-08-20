-- Hard guard: at most one active (queued|running) machine_queue_items row per cut_plan_item_id.
-- Trigger-based (no functional index with subquery, no schema change to machine_queue_items).
CREATE OR REPLACE FUNCTION public.enforce_unique_active_queue_per_cpi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpi uuid;
  v_conflict uuid;
BEGIN
  IF NEW.status NOT IN ('queued','running') THEN
    RETURN NEW;
  END IF;

  SELECT cut_plan_item_id INTO v_cpi
    FROM public.production_tasks
   WHERE id = NEW.task_id;

  IF v_cpi IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT mqi.id INTO v_conflict
    FROM public.machine_queue_items mqi
    JOIN public.production_tasks pt ON pt.id = mqi.task_id
   WHERE pt.cut_plan_item_id = v_cpi
     AND mqi.status IN ('queued','running')
     AND mqi.id <> NEW.id
   LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION
      'duplicate_active_queue_for_cut_plan_item: cpi=% already active on queue row %',
      v_cpi, v_conflict
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_unique_active_queue_per_cpi ON public.machine_queue_items;
CREATE TRIGGER trg_enforce_unique_active_queue_per_cpi
  BEFORE INSERT OR UPDATE OF status, task_id, machine_id
  ON public.machine_queue_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_unique_active_queue_per_cpi();