CREATE OR REPLACE FUNCTION public.auto_advance_cleared_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cleared'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'cleared') THEN
    UPDATE public.cut_plan_items
       SET phase = 'complete'
     WHERE id = NEW.cut_plan_item_id
       AND phase = 'clearance';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_advance_cleared_item ON public.clearance_evidence;

CREATE TRIGGER trg_auto_advance_cleared_item
AFTER INSERT OR UPDATE OF status ON public.clearance_evidence
FOR EACH ROW
EXECUTE FUNCTION public.auto_advance_cleared_item();

UPDATE public.cut_plan_items cpi
   SET phase = 'complete'
  FROM public.clearance_evidence ce
 WHERE ce.cut_plan_item_id = cpi.id
   AND ce.status = 'cleared'
   AND cpi.phase = 'clearance';