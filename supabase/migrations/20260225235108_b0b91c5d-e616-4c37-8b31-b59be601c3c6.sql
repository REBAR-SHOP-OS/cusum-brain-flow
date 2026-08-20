
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
  -- Accept both 'bending' and 'cut_done' since bender no longer manually sets phase
  IF NEW.bend_completed_pieces >= NEW.total_pieces 
     AND NEW.total_pieces > 0
     AND NEW.phase IN ('bending', 'cut_done') THEN
    NEW.phase := 'clearance';
  END IF;
  
  RETURN NEW;
END;
$function$;
