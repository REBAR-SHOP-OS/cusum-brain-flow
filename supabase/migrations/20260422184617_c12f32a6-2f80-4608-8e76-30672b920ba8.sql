-- Defensive guard + legacy A2001 cleanup
CREATE OR REPLACE FUNCTION public.auto_advance_item_phase()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_default public.fulfillment_channel;
BEGIN
  -- Defensive guard: never allow direct jump to 'complete' from production phases.
  -- All items must pass through 'clearance' for QC (production-flow-governance).
  IF NEW.phase = 'complete'
     AND TG_OP = 'UPDATE'
     AND OLD.phase IN ('queued', 'cutting', 'cut_done', 'bending') THEN
    NEW.phase := 'clearance';
  END IF;

  -- Cutting complete → advance to cut_done (bend) or clearance (straight)
  IF NEW.completed_pieces >= NEW.total_pieces
     AND NEW.total_pieces > 0
     AND NEW.phase IN ('queued', 'cutting') THEN
    IF NEW.bend_type = 'bend' THEN
      NEW.phase := 'cut_done';
    ELSE
      NEW.phase := 'clearance';
    END IF;
  END IF;

  -- Bending complete → advance to clearance
  IF NEW.bend_completed_pieces >= NEW.total_pieces
     AND NEW.total_pieces > 0
     AND NEW.phase IN ('bending', 'cut_done') THEN
    NEW.phase := 'clearance';
  END IF;

  -- Transition into 'complete' → auto-stage into a fulfillment channel
  IF NEW.phase = 'complete'
     AND (TG_OP = 'INSERT' OR OLD.phase IS DISTINCT FROM 'complete') THEN
    IF NEW.fulfillment_channel IS NULL THEN
      SELECT p.default_fulfillment_channel INTO v_default
      FROM public.cut_plans cp
      JOIN public.projects p ON p.id = cp.project_id
      WHERE cp.id = NEW.cut_plan_id;
      NEW.fulfillment_channel := COALESCE(v_default, 'pickup'::public.fulfillment_channel);
    END IF;
    IF NEW.ready_at IS NULL THEN
      NEW.ready_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Legacy cleanup: revert A2001 rows stuck at 'complete' back to 'clearance'
UPDATE public.cut_plan_items
SET phase = 'clearance',
    fulfillment_channel = NULL,
    ready_at = NULL
WHERE id IN (
  '3799e34d-7c8e-4dc2-ab76-2a25d6ccf2f9',
  '69b66d16-077c-4c82-b967-c0262e8bfff3',
  '35530866-f77a-4729-bc2e-87704363029b'
)
AND phase = 'complete'
AND delivery_id IS NULL
AND loading_list_id IS NULL
AND pickup_id IS NULL;