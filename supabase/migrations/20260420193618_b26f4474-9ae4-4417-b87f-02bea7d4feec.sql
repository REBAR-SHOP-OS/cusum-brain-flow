-- A) Phase-driven trigger to auto-create bend_batches when cut_plan_items reaches cut_done
CREATE OR REPLACE FUNCTION public.auto_create_bend_batch_from_phase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_machine_id uuid;
  v_status text;
  v_planned int;
BEGIN
  -- Only act on bend items transitioning into cut_done
  IF NEW.bend_type IS DISTINCT FROM 'bend' THEN
    RETURN NEW;
  END IF;
  IF NEW.phase IS DISTINCT FROM 'cut_done' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.phase = NEW.phase THEN
    RETURN NEW;
  END IF;

  -- Resolve company
  SELECT cp.company_id INTO v_company_id
  FROM public.cut_plans cp WHERE cp.id = NEW.cut_plan_id;
  IF v_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotency: skip if a bend batch already exists for this job
  IF EXISTS (
    SELECT 1 FROM public.bend_batches bb
    WHERE bb.source_job_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Spiral routing: T3/T3A → SPIRAL-01
  IF UPPER(COALESCE(NEW.asa_shape_code,'')) IN ('T3','T3A') THEN
    SELECT m.id INTO v_machine_id
    FROM public.machines m
    WHERE m.company_id = v_company_id AND m.name = 'SPIRAL-01'
    LIMIT 1;
  END IF;

  -- Fallback: capability-based assignment
  IF v_machine_id IS NULL THEN
    SELECT mc.machine_id INTO v_machine_id
    FROM public.machine_capabilities mc
    JOIN public.machines m ON m.id = mc.machine_id
    WHERE m.company_id = v_company_id
      AND mc.process = 'bend'
      AND mc.bar_code = NEW.bar_code
    ORDER BY mc.machine_id
    LIMIT 1;
  END IF;

  v_planned := COALESCE(NEW.total_pieces, 0);

  -- Smart status based on bend_completed_pieces
  IF COALESCE(NEW.bend_completed_pieces, 0) >= v_planned AND v_planned > 0 THEN
    v_status := 'bend_complete';
  ELSIF COALESCE(NEW.bend_completed_pieces, 0) > 0 THEN
    v_status := 'bending';
  ELSE
    v_status := 'queued';
  END IF;

  INSERT INTO public.bend_batches (
    company_id, source_cut_batch_id, source_job_id, machine_id,
    shape, size, planned_qty, actual_qty, status, created_by
  ) VALUES (
    v_company_id, NULL, NEW.id, v_machine_id,
    NEW.asa_shape_code, NEW.bar_code, v_planned,
    CASE WHEN COALESCE(NEW.bend_completed_pieces,0) > 0 THEN NEW.bend_completed_pieces ELSE NULL END,
    v_status, NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_bend_batch_from_phase ON public.cut_plan_items;
CREATE TRIGGER trg_auto_create_bend_batch_from_phase
AFTER UPDATE OF phase ON public.cut_plan_items
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_bend_batch_from_phase();

-- B) Backfill existing orphaned items
INSERT INTO public.bend_batches (
  company_id, source_cut_batch_id, source_job_id, machine_id,
  shape, size, planned_qty, actual_qty, status, created_by
)
SELECT
  cp.company_id,
  NULL,
  cpi.id,
  COALESCE(
    -- Spiral first for T3/T3A
    (SELECT m.id FROM public.machines m
     WHERE m.company_id = cp.company_id AND m.name = 'SPIRAL-01'
       AND UPPER(COALESCE(cpi.asa_shape_code,'')) IN ('T3','T3A')
     LIMIT 1),
    -- Capability fallback
    (SELECT mc.machine_id FROM public.machine_capabilities mc
     JOIN public.machines m ON m.id = mc.machine_id
     WHERE m.company_id = cp.company_id
       AND mc.process = 'bend'
       AND mc.bar_code = cpi.bar_code
     ORDER BY mc.machine_id
     LIMIT 1)
  ),
  cpi.asa_shape_code,
  cpi.bar_code,
  COALESCE(cpi.total_pieces, 0),
  CASE WHEN COALESCE(cpi.bend_completed_pieces,0) > 0 THEN cpi.bend_completed_pieces ELSE NULL END,
  CASE
    WHEN COALESCE(cpi.bend_completed_pieces,0) >= COALESCE(cpi.total_pieces,0) AND COALESCE(cpi.total_pieces,0) > 0 THEN 'bend_complete'
    WHEN COALESCE(cpi.bend_completed_pieces,0) > 0 THEN 'bending'
    ELSE 'queued'
  END,
  NULL
FROM public.cut_plan_items cpi
JOIN public.cut_plans cp ON cp.id = cpi.cut_plan_id
WHERE cpi.bend_type = 'bend'
  AND cpi.phase IN ('cut_done','bending','clearance')
  AND NOT EXISTS (
    SELECT 1 FROM public.bend_batches bb WHERE bb.source_job_id = cpi.id
  );