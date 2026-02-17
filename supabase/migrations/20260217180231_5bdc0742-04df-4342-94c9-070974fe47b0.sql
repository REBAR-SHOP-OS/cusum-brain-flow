
CREATE TABLE public.transaction_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  customer_qb_id TEXT,
  trigger_condition JSONB NOT NULL DEFAULT '{}',
  action_type TEXT NOT NULL,
  action_payload_template JSONB NOT NULL DEFAULT '{}',
  times_used INTEGER NOT NULL DEFAULT 0,
  auto_suggest BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read company patterns"
ON public.transaction_patterns FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert company patterns"
ON public.transaction_patterns FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Users can update company patterns"
ON public.transaction_patterns FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete own patterns"
ON public.transaction_patterns FOR DELETE TO authenticated
USING (created_by = auth.uid());

CREATE TRIGGER update_transaction_patterns_updated_at
BEFORE UPDATE ON public.transaction_patterns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_transaction_patterns_company ON public.transaction_patterns(company_id);
CREATE INDEX idx_transaction_patterns_customer ON public.transaction_patterns(customer_qb_id);
