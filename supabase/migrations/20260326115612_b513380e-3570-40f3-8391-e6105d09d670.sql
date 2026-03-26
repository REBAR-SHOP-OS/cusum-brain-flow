-- Expand trigger to also fire on completed_pieces changes
-- Drop and recreate the trigger to cover both phase AND completed_pieces updates
DROP TRIGGER IF EXISTS trg_auto_complete_cut_plan ON public.cut_plan_items;

CREATE OR REPLACE FUNCTION auto_complete_cut_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total INT;
  _terminal INT;
BEGIN
  -- Check if all items in this plan are in terminal phase
  SELECT
    count(*),
    count(*) FILTER (WHERE phase IN ('complete', 'clearance'))
  INTO _total, _terminal
  FROM public.cut_plan_items
  WHERE cut_plan_id = NEW.cut_plan_id;

  IF _total > 0 AND _total = _terminal THEN
    UPDATE public.cut_plans
    SET status = 'completed', updated_at = now()
    WHERE id = NEW.cut_plan_id
      AND status NOT IN ('completed', 'canceled');
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger to fire on both phase AND completed_pieces changes
CREATE TRIGGER trg_auto_complete_cut_plan
  AFTER UPDATE OF phase, completed_pieces ON public.cut_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_cut_plan();
