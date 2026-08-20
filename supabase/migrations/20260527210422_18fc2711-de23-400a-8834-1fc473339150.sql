-- Auto-sync work_orders.status when all cut_plan_items have moved past cutting
CREATE OR REPLACE FUNCTION public._wo_sync_status_from_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wo_ids uuid[];
  v_wo_id uuid;
  v_pending int;
  v_total int;
  v_status text;
BEGIN
  -- Collect affected WO ids from both OLD and NEW rows (handles UPDATE/INSERT/DELETE)
  SELECT array_agg(DISTINCT wid) INTO v_wo_ids FROM (
    SELECT NEW.work_order_id AS wid WHERE TG_OP IN ('INSERT','UPDATE') AND NEW.work_order_id IS NOT NULL
    UNION
    SELECT OLD.work_order_id AS wid WHERE TG_OP IN ('UPDATE','DELETE') AND OLD.work_order_id IS NOT NULL
  ) s WHERE wid IS NOT NULL;

  IF v_wo_ids IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  FOREACH v_wo_id IN ARRAY v_wo_ids LOOP
    SELECT status INTO v_status FROM public.work_orders WHERE id = v_wo_id;
    IF v_status IS NULL OR v_status IN ('completed','cancelled','archived','on_hold') THEN CONTINUE; END IF;

    SELECT
      count(*) FILTER (WHERE lower(coalesce(phase,'')) IN ('queued','cutting')),
      count(*)
    INTO v_pending, v_total
    FROM public.cut_plan_items
    WHERE work_order_id = v_wo_id;

    IF v_total = 0 THEN CONTINUE; END IF;

    -- All items past cutting and WO still 'pending' → advance to 'in_progress'
    IF v_pending = 0 AND v_status = 'pending' THEN
      UPDATE public.work_orders
         SET status = 'in_progress',
             actual_start = COALESCE(actual_start, now())
       WHERE id = v_wo_id;
    END IF;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_wo_sync_status_from_items ON public.cut_plan_items;
CREATE TRIGGER trg_wo_sync_status_from_items
AFTER INSERT OR UPDATE OF phase OR DELETE ON public.cut_plan_items
FOR EACH ROW EXECUTE FUNCTION public._wo_sync_status_from_items();

-- One-time backfill: WOs still 'pending' whose every item is past cutting
UPDATE public.work_orders wo
   SET status = 'in_progress',
       actual_start = COALESCE(actual_start, now())
 WHERE wo.status = 'pending'
   AND EXISTS (SELECT 1 FROM public.cut_plan_items cpi WHERE cpi.work_order_id = wo.id)
   AND NOT EXISTS (
     SELECT 1 FROM public.cut_plan_items cpi
      WHERE cpi.work_order_id = wo.id
        AND lower(coalesce(cpi.phase,'')) IN ('queued','cutting')
   );