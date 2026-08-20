-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create leads table for pipeline management
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id),
  contact_id UUID REFERENCES public.contacts(id),
  quote_id UUID REFERENCES public.quotes(id),
  title TEXT NOT NULL,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'new',
  probability INTEGER DEFAULT 10,
  expected_value NUMERIC,
  expected_close_date TIMESTAMP WITH TIME ZONE,
  source TEXT,
  assigned_to UUID,
  priority TEXT DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read leads" ON public.leads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert leads" ON public.leads FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update leads" ON public.leads FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete leads" ON public.leads FOR DELETE USING (auth.role() = 'authenticated');

-- Timestamp trigger
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();