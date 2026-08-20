
-- Create ventures table for Empire Builder module
CREATE TABLE public.ventures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid,
  name text NOT NULL,
  vertical text,
  phase text NOT NULL DEFAULT 'target_selection',
  problem_statement text,
  target_customer text,
  value_multiplier text,
  competitive_notes text,
  mvp_scope text,
  distribution_plan text,
  metrics jsonb DEFAULT '{}'::jsonb,
  revenue_model text,
  ai_analysis jsonb,
  linked_lead_id uuid,
  linked_order_ids uuid[] DEFAULT '{}',
  odoo_context jsonb,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for phase and status
CREATE OR REPLACE FUNCTION public.validate_venture_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.phase NOT IN ('target_selection', 'weapon_build', 'market_feedback', 'scale_engine', 'empire_expansion') THEN
    RAISE EXCEPTION 'Invalid venture phase: %', NEW.phase;
  END IF;
  IF NEW.status NOT IN ('active', 'paused', 'killed', 'won') THEN
    RAISE EXCEPTION 'Invalid venture status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_venture_fields_trigger
BEFORE INSERT OR UPDATE ON public.ventures
FOR EACH ROW EXECUTE FUNCTION public.validate_venture_fields();

-- Updated_at trigger
CREATE TRIGGER update_ventures_updated_at
BEFORE UPDATE ON public.ventures
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.ventures ENABLE ROW LEVEL SECURITY;

-- Users can see their own ventures
CREATE POLICY "Users can view own ventures"
ON public.ventures FOR SELECT
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Users can create their own ventures
CREATE POLICY "Users can create own ventures"
ON public.ventures FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Users can update their own ventures
CREATE POLICY "Users can update own ventures"
ON public.ventures FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Users can delete their own ventures
CREATE POLICY "Users can delete own ventures"
ON public.ventures FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
