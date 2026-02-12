
ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_communications_lead_id ON public.communications(lead_id);
