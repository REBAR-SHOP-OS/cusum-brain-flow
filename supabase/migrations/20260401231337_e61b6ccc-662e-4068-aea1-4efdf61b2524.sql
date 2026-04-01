
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
      cp.company_id,
      NULL::uuid,
      cpi.work_order_id,
      cp.id,
      cpi.id,
      CASE WHEN cpi.bend_type = 'bend' THEN 'bend' ELSE 'cut' END,
      cpi.bar_code, 100,
      CASE
        WHEN cpi.completed_pieces >= cpi.total_pieces THEN 'done'
        WHEN cpi.completed_pieces > 0 THEN 'running'
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
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::bigint FROM to_insert;
END;
$$;
