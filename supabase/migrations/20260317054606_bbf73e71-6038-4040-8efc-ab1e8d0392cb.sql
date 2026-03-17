
-- Part 1: Trigger to auto-complete cut_plans when all items reach terminal phase
CREATE OR REPLACE FUNCTION public.auto_complete_cut_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total INT;
  _terminal INT;
BEGIN
  -- Only fire when phase changes
  IF OLD.phase IS NOT DISTINCT FROM NEW.phase THEN
    RETURN NEW;
  END IF;

  -- Count total items and terminal items for this plan
  SELECT
    count(*),
    count(*) FILTER (WHERE phase IN ('complete', 'clearance'))
  INTO _total, _terminal
  FROM public.cut_plan_items
  WHERE cut_plan_id = NEW.cut_plan_id;

  -- If all items are terminal, mark the plan as complete
  IF _total > 0 AND _total = _terminal THEN
    UPDATE public.cut_plans
    SET status = 'complete', updated_at = now()
    WHERE id = NEW.cut_plan_id
      AND status NOT IN ('complete', 'cancelled');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_complete_cut_plan
AFTER UPDATE OF phase ON public.cut_plan_items
FOR EACH ROW
EXECUTE FUNCTION public.auto_complete_cut_plan();
