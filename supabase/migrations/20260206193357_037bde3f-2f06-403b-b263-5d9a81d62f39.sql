-- Create estimation learnings table for Cal agent
CREATE TABLE public.estimation_learnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_name TEXT NOT NULL,
  learning_type TEXT NOT NULL CHECK (learning_type IN ('correction', 'pattern', 'client_preference', 'scale_reference', 'rebar_standard', 'wwm_standard')),
  original_value JSONB,
  corrected_value JSONB,
  context TEXT,
  element_type TEXT,
  confidence_score NUMERIC DEFAULT 0.5,
  usage_count INTEGER DEFAULT 0,
  is_global BOOLEAN DEFAULT false,
  source_files TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_estimation_learnings_type ON public.estimation_learnings(learning_type);
CREATE INDEX idx_estimation_learnings_element ON public.estimation_learnings(element_type);
CREATE INDEX idx_estimation_learnings_global ON public.estimation_learnings(is_global);

-- Enable RLS
ALTER TABLE public.estimation_learnings ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read all learnings (shared knowledge)
CREATE POLICY "Authenticated users can read estimation_learnings"
ON public.estimation_learnings
FOR SELECT
USING (auth.role() = 'authenticated'::text);

-- Policy: authenticated users can insert their own learnings
CREATE POLICY "Authenticated users can insert estimation_learnings"
ON public.estimation_learnings
FOR INSERT
WITH CHECK (auth.role() = 'authenticated'::text);

-- Policy: users can update their own learnings
CREATE POLICY "Users can update own estimation_learnings"
ON public.estimation_learnings
FOR UPDATE
USING (created_by = auth.uid());

-- Policy: users can delete their own learnings
CREATE POLICY "Users can delete own estimation_learnings"
ON public.estimation_learnings
FOR DELETE
USING (created_by = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_estimation_learnings_updated_at
BEFORE UPDATE ON public.estimation_learnings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial learnings from the analyzed project (5 Clarendon Cres)
INSERT INTO public.estimation_learnings (project_name, learning_type, corrected_value, context, element_type, is_global, source_files) VALUES
-- Foundation patterns
('5 Clarendon Cres', 'pattern', '{"type": "F1", "size": "6''-80+86$", "rebar": "7-20M B.E.W."}', 'Foundation Schedule from structural drawings', 'foundation', true, ARRAY['Structural_Set_5_Clarendon_Cres_Aug_1_25.pdf']),
('5 Clarendon Cres', 'pattern', '{"type": "F2", "rebar": "8-20M B.E.W."}', 'Foundation Schedule', 'foundation', true, ARRAY['Structural_Set_5_Clarendon_Cres_Aug_1_25.pdf']),
('5 Clarendon Cres', 'pattern', '{"type": "F3", "rebar": "8-15M B.E.W."}', 'Foundation Schedule', 'foundation', true, ARRAY['Structural_Set_5_Clarendon_Cres_Aug_1_25.pdf']),
('5 Clarendon Cres', 'pattern', '{"type": "F4", "rebar": "7-15M B.E.W."}', 'Foundation Schedule', 'foundation', true, ARRAY['Structural_Set_5_Clarendon_Cres_Aug_1_25.pdf']),
('5 Clarendon Cres', 'pattern', '{"type": "F5", "rebar": "8-15M B.E.W."}', 'Foundation Schedule', 'foundation', true, ARRAY['Structural_Set_5_Clarendon_Cres_Aug_1_25.pdf']),
-- Pier patterns
('5 Clarendon Cres', 'pattern', '{"type": "P2", "rebar": "4-15M VERT", "ties": "10M@250"}', 'Piers Schedule - residential pier standard', 'pier', true, ARRAY['Structural_Set_5_Clarendon_Cres_Aug_1_25.pdf']),
-- Steel column patterns
('5 Clarendon Cres', 'pattern', '{"type": "C2", "material": "6x3/4x12", "base_plate": "6x3/4x6"}', 'Steel Column Schedule', 'column', true, ARRAY['Structural_Set_5_Clarendon_Cres_Aug_1_25.pdf']),
('5 Clarendon Cres', 'pattern', '{"type": "C3", "material": "5x1/2x10", "base_plate": "5x1/2x5"}', 'Steel Column Schedule', 'column', true, ARRAY['Structural_Set_5_Clarendon_Cres_Aug_1_25.pdf']),
-- Rebar standards
('5 Clarendon Cres', 'rebar_standard', '{"horizontal": "2-15M CONT", "dowels": "15M@12\" o.c.", "slab_dowels": "15M@16\" o.c."}', 'Typical wall and slab reinforcement', 'wall', true, ARRAY['Structural_Set_5_Clarendon_Cres_Aug_1_25.pdf']),
-- Scale reference
('5 Clarendon Cres', 'scale_reference', '{"scale": "3/4\"=1''-0\"", "project_number": "224064"}', 'Standard scale for residential projects in Toronto', 'general', true, ARRAY['Structural_Set_5_Clarendon_Cres_Aug_1_25.pdf']);