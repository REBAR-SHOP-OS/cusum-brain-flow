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

    -- Spiral shapes (T3/T3A) ALWAYS go to SPIRAL-01 regardless of capabilities
    IF UPPER(COALESCE(v_item.asa_shape_code, '')) IN ('T3', 'T3A') THEN
      SELECT id INTO v_machine_id
        FROM public.machines
       WHERE company_id = NEW.company_id
         AND name = 'SPIRAL-01'
       LIMIT 1;
    END IF;

    -- Fallback: capability-based assignment (non-spiral shapes only)
    IF v_machine_id IS NULL THEN
      SELECT mc.machine_id INTO v_machine_id
        FROM public.machine_capabilities mc
        JOIN public.machines m ON m.id = mc.machine_id
       WHERE mc.process = 'bend'
         AND mc.bar_code = v_item.bar_code
         AND m.company_id = NEW.company_id
       LIMIT 1;
    END IF;

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

-- Backfill: re-route existing queued T3/T3A batches to SPIRAL-01
UPDATE public.bend_batches bb
   SET machine_id = (
     SELECT id FROM public.machines
      WHERE company_id = bb.company_id AND name = 'SPIRAL-01' LIMIT 1
   )
 WHERE UPPER(COALESCE(bb.shape, '')) IN ('T3', 'T3A')
   AND bb.status = 'queued';