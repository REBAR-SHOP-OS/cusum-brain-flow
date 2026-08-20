
-- Leave balances table
CREATE TABLE public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL DEFAULT extract(year FROM now())::integer,
  vacation_days_entitled NUMERIC NOT NULL DEFAULT 10,
  vacation_days_used NUMERIC NOT NULL DEFAULT 0,
  sick_days_entitled NUMERIC NOT NULL DEFAULT 3,
  sick_days_used NUMERIC NOT NULL DEFAULT 0,
  personal_days_entitled NUMERIC NOT NULL DEFAULT 2,
  personal_days_used NUMERIC NOT NULL DEFAULT 0,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, year)
);

-- Leave requests table
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- RLS: employees see own balances
CREATE POLICY "Users can view own leave balances"
ON public.leave_balances FOR SELECT TO authenticated
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- RLS: admins see all company balances
CREATE POLICY "Admins can view all company leave balances"
ON public.leave_balances FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS: admins can insert/update balances
CREATE POLICY "Admins can manage leave balances"
ON public.leave_balances FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS: employees see own requests
CREATE POLICY "Users can view own leave requests"
ON public.leave_requests FOR SELECT TO authenticated
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- RLS: admins see all company requests
CREATE POLICY "Admins can view all company leave requests"
ON public.leave_requests FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS: employees can insert own requests
CREATE POLICY "Users can create own leave requests"
ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND company_id = public.get_user_company_id(auth.uid())
);

-- RLS: employees can cancel own pending requests
CREATE POLICY "Users can update own pending requests"
ON public.leave_requests FOR UPDATE TO authenticated
USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND status = 'pending'
)
WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- RLS: admins can update any company request (approve/deny)
CREATE POLICY "Admins can update company leave requests"
ON public.leave_requests FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Validation trigger for leave_requests
CREATE OR REPLACE FUNCTION public.validate_leave_request_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.leave_type NOT IN ('vacation', 'sick', 'personal', 'bereavement', 'unpaid') THEN
    RAISE EXCEPTION 'Invalid leave_type: %', NEW.leave_type;
  END IF;
  IF NEW.status NOT IN ('pending', 'approved', 'denied', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid leave request status: %', NEW.status;
  END IF;
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date cannot be before start_date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_leave_request
BEFORE INSERT OR UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_leave_request_fields();

-- Auto-update leave_balances when request is approved
CREATE OR REPLACE FUNCTION public.update_leave_balance_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Ensure balance row exists for this year
    INSERT INTO public.leave_balances (profile_id, year, company_id)
    VALUES (NEW.profile_id, extract(year FROM NEW.start_date)::integer, NEW.company_id)
    ON CONFLICT (profile_id, year) DO NOTHING;

    -- Increment used days
    IF NEW.leave_type = 'vacation' THEN
      UPDATE public.leave_balances SET vacation_days_used = vacation_days_used + NEW.total_days, updated_at = now()
      WHERE profile_id = NEW.profile_id AND year = extract(year FROM NEW.start_date)::integer;
    ELSIF NEW.leave_type = 'sick' THEN
      UPDATE public.leave_balances SET sick_days_used = sick_days_used + NEW.total_days, updated_at = now()
      WHERE profile_id = NEW.profile_id AND year = extract(year FROM NEW.start_date)::integer;
    ELSIF NEW.leave_type = 'personal' THEN
      UPDATE public.leave_balances SET personal_days_used = personal_days_used + NEW.total_days, updated_at = now()
      WHERE profile_id = NEW.profile_id AND year = extract(year FROM NEW.start_date)::integer;
    END IF;
  END IF;

  -- If changing FROM approved to something else, reverse the balance
  IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
    IF OLD.leave_type = 'vacation' THEN
      UPDATE public.leave_balances SET vacation_days_used = GREATEST(0, vacation_days_used - OLD.total_days), updated_at = now()
      WHERE profile_id = OLD.profile_id AND year = extract(year FROM OLD.start_date)::integer;
    ELSIF OLD.leave_type = 'sick' THEN
      UPDATE public.leave_balances SET sick_days_used = GREATEST(0, sick_days_used - OLD.total_days), updated_at = now()
      WHERE profile_id = OLD.profile_id AND year = extract(year FROM OLD.start_date)::integer;
    ELSIF OLD.leave_type = 'personal' THEN
      UPDATE public.leave_balances SET personal_days_used = GREATEST(0, personal_days_used - OLD.total_days), updated_at = now()
      WHERE profile_id = OLD.profile_id AND year = extract(year FROM OLD.start_date)::integer;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_leave_balance
AFTER UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.update_leave_balance_on_approval();

-- Updated_at triggers
CREATE TRIGGER update_leave_balances_updated_at
BEFORE UPDATE ON public.leave_balances
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
