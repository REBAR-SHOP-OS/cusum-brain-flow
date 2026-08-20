-- Bridge cleared → complete so downstream stations (LoadingStation, PickupStation,
-- useReadyToShip, useCompletedBundles, MaterialFlowDiagram) which filter on
-- phase='complete' continue to see items released by the QC clearance gate.
-- Legal path per validate_cut_plan_item_transition: clearance → cleared → complete.

CREATE OR REPLACE FUNCTION public.auto_bridge_cleared_to_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phase = 'cleared' AND OLD.phase = 'clearance' THEN
    -- Recurse via a normal UPDATE so validate_cut_plan_item_transition (BEFORE UPDATE)
    -- sees cleared -> complete, which is an allowed adjacency.
    UPDATE public.cut_plan_items
       SET phase = 'complete'
     WHERE id = NEW.id
       AND phase = 'cleared';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_bridge_cleared_to_complete ON public.cut_plan_items;
CREATE TRIGGER trg_auto_bridge_cleared_to_complete
  AFTER UPDATE OF phase ON public.cut_plan_items
  FOR EACH ROW
  WHEN (NEW.phase = 'cleared' AND OLD.phase = 'clearance')
  EXECUTE FUNCTION public.auto_bridge_cleared_to_complete();

-- Backfill: any items currently parked at 'cleared' should hop to 'complete'.
UPDATE public.cut_plan_items
   SET phase = 'complete'
 WHERE phase = 'cleared';