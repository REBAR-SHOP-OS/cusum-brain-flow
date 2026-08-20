
-- 1. Quote linkage
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_lead_id ON public.quotes(lead_id) WHERE lead_id IS NOT NULL;

-- Quote -> lead expected_value sync trigger
CREATE OR REPLACE FUNCTION public.sync_quote_to_lead_expected_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND NEW.total_amount IS NOT NULL AND NEW.total_amount > 0 THEN
    UPDATE leads
    SET expected_value = NEW.total_amount,
        quote_id = NEW.id
    WHERE id = NEW.lead_id
      AND (expected_value IS NULL OR expected_value = 0 OR expected_value < NEW.total_amount);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_quote_to_lead ON public.quotes;
CREATE TRIGGER trg_sync_quote_to_lead
  AFTER INSERT OR UPDATE OF lead_id, total_amount ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_quote_to_lead_expected_value();

-- 2. Auto-generate production tasks on cut plan queued
CREATE OR REPLACE FUNCTION public.auto_generate_production_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'queued' AND (OLD.status IS NULL OR OLD.status != 'queued') THEN
    INSERT INTO production_tasks (
      company_id, work_order_id, cut_plan_id, cut_plan_item_id,
      task_type, bar_code, priority, status,
      qty_required, qty_completed,
      mark_number, drawing_ref, cut_length_mm,
      asa_shape_code, bend_dimensions, notes,
      barlist_id, order_id
    )
    SELECT
      NEW.company_id, cpi.work_order_id, NEW.id, cpi.id,
      CASE WHEN cpi.bend_type = 'bend' THEN 'bend' ELSE 'cut' END,
      cpi.bar_code, 100, 'pending',
      cpi.total_pieces, 0,
      cpi.mark_number, cpi.drawing_ref, cpi.cut_length_mm,
      cpi.asa_shape_code, cpi.bend_dimensions, cpi.notes,
      NEW.barlist_id, wo.order_id
    FROM cut_plan_items cpi
    LEFT JOIN work_orders wo ON wo.id = cpi.work_order_id
    WHERE cpi.cut_plan_id = NEW.id
      AND NOT EXISTS (
        SELECT 1 FROM production_tasks pt WHERE pt.cut_plan_item_id = cpi.id
      )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_gen_production_tasks ON public.cut_plans;
CREATE TRIGGER trg_auto_gen_production_tasks
  AFTER UPDATE OF status ON public.cut_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_production_tasks();
