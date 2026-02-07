
-- Add lifecycle phase tracking and separate bend completion counter
ALTER TABLE public.cut_plan_items 
ADD COLUMN phase TEXT NOT NULL DEFAULT 'queued',
ADD COLUMN bend_completed_pieces INTEGER NOT NULL DEFAULT 0;

-- Backfill phase for existing data based on current completion state
UPDATE public.cut_plan_items 
SET phase = CASE 
  WHEN completed_pieces >= total_pieces AND total_pieces > 0 AND bend_type = 'bend' THEN 'cut_done'
  WHEN completed_pieces >= total_pieces AND total_pieces > 0 AND bend_type != 'bend' THEN 'complete'
  ELSE 'queued'
END;

-- Auto-advance phase when cutting or bending completes
CREATE OR REPLACE FUNCTION public.auto_advance_item_phase()
RETURNS TRIGGER AS $$
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
  
  -- Bending complete → advance to complete
  IF NEW.bend_completed_pieces >= NEW.total_pieces 
     AND NEW.total_pieces > 0
     AND NEW.phase = 'bending' THEN
    NEW.phase := 'complete';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_auto_advance_item_phase
BEFORE UPDATE ON public.cut_plan_items
FOR EACH ROW
EXECUTE FUNCTION public.auto_advance_item_phase();

-- Index for fast bender queries
CREATE INDEX idx_cut_plan_items_phase_bend ON public.cut_plan_items (phase, bend_type);
