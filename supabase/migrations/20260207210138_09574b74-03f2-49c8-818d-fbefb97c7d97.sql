
-- Update auto_advance_item_phase: bending complete → clearance (not complete)
CREATE OR REPLACE FUNCTION public.auto_advance_item_phase()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Cutting complete → advance to cut_done (bend) or complete (straight)
  IF NEW.completed_pieces >= NEW.total_pieces 
     AND NEW.total_pieces > 0
     AND NEW.phase IN ('queued', 'cutting') THEN
    IF NEW.bend_type = 'bend' THEN
      NEW.phase := 'cut_done';
    ELSE
      NEW.phase := 'complete';
    END IF;
  END IF;
  
  -- Bending complete → advance to clearance
  IF NEW.bend_completed_pieces >= NEW.total_pieces 
     AND NEW.total_pieces > 0
     AND NEW.phase = 'bending' THEN
    NEW.phase := 'clearance';
  END IF;
  
  RETURN NEW;
END;
$function$;
