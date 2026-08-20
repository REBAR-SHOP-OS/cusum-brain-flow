
-- Employee Contracts
CREATE TABLE public.employee_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'default',
  employee_name TEXT NOT NULL,
  employee_email TEXT,
  position TEXT NOT NULL,
  department TEXT,
  contract_type TEXT NOT NULL DEFAULT 'permanent',
  start_date DATE NOT NULL,
  end_date DATE,
  salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  salary_currency TEXT NOT NULL DEFAULT 'AUD',
  pay_frequency TEXT NOT NULL DEFAULT 'monthly',
  probation_end_date DATE,
  notice_period_days INTEGER DEFAULT 30,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/accounting can view contracts" ON public.employee_contracts
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accounting')
  );

CREATE POLICY "Admin can manage contracts" ON public.employee_contracts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Salary history
CREATE TABLE public.salary_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.employee_contracts(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  previous_salary NUMERIC(12,2),
  new_salary NUMERIC(12,2) NOT NULL,
  reason TEXT,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/accounting can view salary history" ON public.salary_history
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accounting')
  );

CREATE POLICY "Admin can manage salary history" ON public.salary_history
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Employee Certifications
CREATE TABLE public.employee_certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL DEFAULT 'default',
  employee_name TEXT NOT NULL,
  employee_email TEXT,
  certification_name TEXT NOT NULL,
  issuing_body TEXT,
  certificate_number TEXT,
  issued_date DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  reminder_days INTEGER DEFAULT 30,
  notes TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.employee_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/accounting can view certifications" ON public.employee_certifications
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accounting')
  );

CREATE POLICY "Admin can manage certifications" ON public.employee_certifications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Timestamps triggers
CREATE TRIGGER update_employee_contracts_updated_at
  BEFORE UPDATE ON public.employee_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_certifications_updated_at
  BEFORE UPDATE ON public.employee_certifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
