
-- Add employee_type to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_type text;

-- payroll_daily_snapshot
CREATE TABLE public.payroll_daily_snapshot (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  employee_type text NOT NULL DEFAULT 'workshop',
  raw_clock_in timestamptz,
  raw_clock_out timestamptz,
  lunch_deducted_minutes int NOT NULL DEFAULT 30,
  paid_break_minutes int NOT NULL DEFAULT 0,
  expected_minutes int NOT NULL DEFAULT 510,
  paid_minutes int NOT NULL DEFAULT 0,
  overtime_minutes int NOT NULL DEFAULT 0,
  exceptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_notes text,
  status text NOT NULL DEFAULT 'auto',
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, work_date)
);

ALTER TABLE public.payroll_daily_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all snapshots in company"
  ON public.payroll_daily_snapshot FOR SELECT
  USING (company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Admins insert snapshots"
  ON public.payroll_daily_snapshot FOR INSERT
  WITH CHECK (company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Admins update snapshots"
  ON public.payroll_daily_snapshot FOR UPDATE
  USING (company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ));

-- payroll_weekly_summary
CREATE TABLE public.payroll_weekly_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  employee_type text NOT NULL DEFAULT 'workshop',
  total_paid_hours numeric NOT NULL DEFAULT 0,
  regular_hours numeric NOT NULL DEFAULT 0,
  overtime_hours numeric NOT NULL DEFAULT 0,
  total_exceptions int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  locked_at timestamptz,
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, week_start)
);

ALTER TABLE public.payroll_weekly_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members read weekly summaries"
  ON public.payroll_weekly_summary FOR SELECT
  USING (company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Company members insert weekly summaries"
  ON public.payroll_weekly_summary FOR INSERT
  WITH CHECK (company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Company members update weekly summaries"
  ON public.payroll_weekly_summary FOR UPDATE
  USING (company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ));

-- payroll_audit_log
CREATE TABLE public.payroll_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  before_data jsonb,
  after_data jsonb,
  reason text,
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log"
  ON public.payroll_audit_log FOR SELECT
  USING (company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Insert audit log"
  ON public.payroll_audit_log FOR INSERT
  WITH CHECK (company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ));

-- Enable realtime on daily snapshot
ALTER PUBLICATION supabase_realtime ADD TABLE public.payroll_daily_snapshot;
