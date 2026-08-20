
-- Create lead_activities table for timeline tracking
CREATE TABLE public.lead_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view activities for their company leads"
  ON public.lead_activities FOR SELECT
  USING (company_id IN (
    SELECT l.company_id FROM public.leads l WHERE l.id = lead_id
  ));

CREATE POLICY "Users can insert activities"
  ON public.lead_activities FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their activities"
  ON public.lead_activities FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete their activities"
  ON public.lead_activities FOR DELETE
  USING (true);

-- Index for fast lead timeline queries
CREATE INDEX idx_lead_activities_lead_id ON public.lead_activities(lead_id, created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_activities;

-- Trigger for updated_at
CREATE TRIGGER update_lead_activities_updated_at
  BEFORE UPDATE ON public.lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
