
-- Fix trigger to use 'completed' (not 'complete') for cut_plans.status
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
  IF OLD.phase IS NOT DISTINCT FROM NEW.phase THEN
    RETURN NEW;
  END IF;

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
