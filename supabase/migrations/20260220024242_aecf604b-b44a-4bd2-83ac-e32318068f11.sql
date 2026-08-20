
-- Create bid_board table
CREATE TABLE public.bid_board (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  project_name TEXT NOT NULL,
  customer_name TEXT,
  location TEXT,
  bid_due_date TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'new',
  estimator_id UUID REFERENCES public.profiles(id),
  estimated_value NUMERIC DEFAULT 0,
  estimation_project_id UUID REFERENCES public.estimation_projects(id),
  lead_id UUID REFERENCES public.leads(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for bid_board
CREATE OR REPLACE FUNCTION public.validate_bid_board_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid bid_board priority: %', NEW.priority;
  END IF;
  IF NEW.status NOT IN ('new', 'scope_confirmed', 'takeoff_in_progress', 'takeoff_complete', 'quoted', 'won', 'lost') THEN
    RAISE EXCEPTION 'Invalid bid_board status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_bid_board_fields_trigger
BEFORE INSERT OR UPDATE ON public.bid_board
FOR EACH ROW EXECUTE FUNCTION public.validate_bid_board_fields();

-- Enable RLS
ALTER TABLE public.bid_board ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bid_board for their company"
ON public.bid_board FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert bid_board for their company"
ON public.bid_board FOR INSERT
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update bid_board for their company"
ON public.bid_board FOR UPDATE
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete bid_board for their company"
ON public.bid_board FOR DELETE
USING (company_id = public.get_user_company_id(auth.uid()));

-- Alter estimation_projects: add new columns
ALTER TABLE public.estimation_projects
  ADD COLUMN IF NOT EXISTS estimator_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_project_id UUID REFERENCES public.estimation_projects(id);

-- Update timestamp trigger for bid_board
CREATE TRIGGER update_bid_board_updated_at
BEFORE UPDATE ON public.bid_board
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
