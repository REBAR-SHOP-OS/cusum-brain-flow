
-- Scheduled Activities table (Odoo-style: plan calls, emails, meetings with due dates)
CREATE TABLE public.scheduled_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'lead',
  entity_id UUID NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'call',
  summary TEXT NOT NULL,
  note TEXT,
  due_date DATE NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  assigned_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'planned',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company activities"
  ON public.scheduled_activities FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create company activities"
  ON public.scheduled_activities FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update company activities"
  ON public.scheduled_activities FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete company activities"
  ON public.scheduled_activities FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE INDEX idx_scheduled_activities_entity ON public.scheduled_activities(entity_type, entity_id);
CREATE INDEX idx_scheduled_activities_due ON public.scheduled_activities(due_date, status);
CREATE INDEX idx_scheduled_activities_assigned ON public.scheduled_activities(assigned_to);
CREATE INDEX idx_scheduled_activities_company ON public.scheduled_activities(company_id);

CREATE TRIGGER update_scheduled_activities_updated_at
  BEFORE UPDATE ON public.scheduled_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
