
-- 1. Probability normalization trigger
CREATE OR REPLACE FUNCTION public.normalize_lead_probability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IN ('won') THEN
    NEW.probability := 100;
  ELSIF NEW.stage IN ('lost', 'loss', 'disqualified', 'no_rebars_out_of_scope', 'archived_orphan', 'dreamers') THEN
    NEW.probability := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_lead_probability ON public.leads;
CREATE TRIGGER trg_normalize_lead_probability
  BEFORE INSERT OR UPDATE OF stage ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_lead_probability();

-- 2. Backfill function for production_tasks from cut_plan_items
CREATE OR REPLACE FUNCTION public.backfill_production_tasks_from_cut_plans()
RETURNS TABLE(inserted_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH to_insert AS (
    INSERT INTO production_tasks (
      company_id, project_id, work_order_id, cut_plan_id, cut_plan_item_id,
      task_type, bar_code, priority, status,
      qty_required, qty_completed,
      mark_number, drawing_ref, cut_length_mm,
      asa_shape_code, bend_dimensions, notes,
      barlist_id, order_id
    )
    SELECT
      cp.company_id, cp.project_id, cpi.work_order_id, cp.id, cpi.id,
      CASE WHEN cpi.bend_type = 'bend' THEN 'bend' ELSE 'cut' END,
      cpi.bar_code, 100,
      CASE
        WHEN cpi.completed_pieces >= cpi.total_pieces THEN 'completed'
        WHEN cpi.completed_pieces > 0 THEN 'in_progress'
        ELSE 'pending'
      END,
      cpi.total_pieces, cpi.completed_pieces,
      cpi.mark_number, cpi.drawing_ref, cpi.cut_length_mm,
      cpi.asa_shape_code, cpi.bend_dimensions, cpi.notes,
      cp.barlist_id, wo.order_id
    FROM cut_plan_items cpi
    JOIN cut_plans cp ON cp.id = cpi.cut_plan_id
    LEFT JOIN work_orders wo ON wo.id = cpi.work_order_id
    WHERE cp.status IN ('queued', 'completed')
      AND NOT EXISTS (
        SELECT 1 FROM production_tasks pt WHERE pt.cut_plan_item_id = cpi.id
      )
    RETURNING 1
  )
  SELECT count(*)::bigint FROM to_insert;
END;
$$;
