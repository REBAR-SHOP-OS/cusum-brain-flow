CREATE OR REPLACE FUNCTION public.auto_advance_cleared_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'cleared'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'cleared') THEN
    -- Adjacency rule: clearance must hop through 'cleared' first.
    -- The auto_bridge_cleared_to_complete trigger then advances cleared -> complete.
    UPDATE public.cut_plan_items
       SET phase = 'cleared'
     WHERE id = NEW.cut_plan_item_id
       AND phase = 'clearance';
  END IF;
  RETURN NEW;
END;
$function$;

-- Recover any items currently stuck at 'clearance' but with cleared evidence,
-- and any stragglers at 'cleared'.
UPDATE public.cut_plan_items ci
   SET phase = 'cleared'
 WHERE ci.phase = 'clearance'
   AND EXISTS (
     SELECT 1 FROM public.clearance_evidence ce
      WHERE ce.cut_plan_item_id = ci.id AND ce.status = 'cleared'
   );

UPDATE public.cut_plan_items
   SET phase = 'complete'
 WHERE phase = 'cleared';