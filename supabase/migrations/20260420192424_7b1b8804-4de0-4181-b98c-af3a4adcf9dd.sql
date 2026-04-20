DROP TRIGGER IF EXISTS trg_auto_create_bend_batch ON public.cut_plan_items;
DROP FUNCTION IF EXISTS public.auto_create_bend_batch();

CREATE OR REPLACE FUNCTION public.auto_create_bend_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_machine_id uuid;
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.cut_plan_item_id IS NOT NULL
  THEN
    IF EXISTS (
      SELECT 1 FROM public.bend_batches WHERE source_cut_batch_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    SELECT cpi.id, cpi.bend_type, cpi.asa_shape_code, cpi.bar_code,
           cpi.total_pieces, cpi.cut_plan_id
      INTO v_item
      FROM public.cut_plan_items cpi
     WHERE cpi.id = NEW.cut_plan_item_id;

    IF v_item.bend_type IS DISTINCT FROM 'bend' THEN
      RETURN NEW;
    END IF;

    SELECT mc.machine_id INTO v_machine_id
      FROM public.machine_capabilities mc
      JOIN public.machines m ON m.id = mc.machine_id
     WHERE mc.process = 'bend'
       AND mc.bar_code = v_item.bar_code
       AND m.company_id = NEW.company_id
     LIMIT 1;

    INSERT INTO public.bend_batches (
      company_id, source_cut_batch_id, source_job_id,
      machine_id, shape, size, planned_qty, status
    ) VALUES (
      NEW.company_id, NEW.id, v_item.cut_plan_id,
      v_machine_id, v_item.asa_shape_code, v_item.bar_code,
      COALESCE(NEW.actual_qty, NEW.planned_qty, v_item.total_pieces, 0),
      'queued'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_bend_batch ON public.cut_batches;
CREATE TRIGGER trg_auto_create_bend_batch
AFTER UPDATE OF status ON public.cut_batches
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_bend_batch();

-- Backfill: for completed cut_batches whose linked item needs bending and has no bend batch
INSERT INTO public.bend_batches
  (company_id, source_cut_batch_id, source_job_id, machine_id, shape, size, planned_qty, status)
SELECT
  cb.company_id,
  cb.id,
  cpi.cut_plan_id,
  (SELECT mc.machine_id FROM public.machine_capabilities mc
     JOIN public.machines m ON m.id = mc.machine_id
    WHERE mc.process = 'bend' AND mc.bar_code = cpi.bar_code
      AND m.company_id = cb.company_id LIMIT 1),
  cpi.asa_shape_code,
  cpi.bar_code,
  COALESCE(cb.actual_qty, cb.planned_qty, cpi.total_pieces, 0),
  CASE
    WHEN cpi.bend_completed_pieces >= cpi.total_pieces AND cpi.total_pieces > 0 THEN 'bend_complete'
    WHEN cpi.bend_completed_pieces > 0 THEN 'bending'
    ELSE 'queued'
  END
FROM public.cut_batches cb
JOIN public.cut_plan_items cpi ON cpi.id = cb.cut_plan_item_id
WHERE cb.status = 'completed'
  AND cpi.bend_type = 'bend'
  AND NOT EXISTS (
    SELECT 1 FROM public.bend_batches bb WHERE bb.source_cut_batch_id = cb.id
  );