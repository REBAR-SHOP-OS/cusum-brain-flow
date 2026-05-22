CREATE TYPE public.office_clearance_status AS ENUM ('pending','approved','rejected');

CREATE TABLE public.office_clearances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  session_id uuid REFERENCES public.extract_sessions(id) ON DELETE CASCADE,
  order_id uuid,
  title text NOT NULL,
  notes text,
  status public.office_clearance_status NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_office_clearances_company_status ON public.office_clearances (company_id, status);
CREATE INDEX idx_office_clearances_session ON public.office_clearances (session_id);

ALTER TABLE public.office_clearances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office_clearances_select_company"
  ON public.office_clearances FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "office_clearances_insert_company"
  ON public.office_clearances FOR INSERT
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND requested_by = auth.uid()
  );

CREATE POLICY "office_clearances_update_office_admin"
  ON public.office_clearances FOR UPDATE
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'office'::app_role))
  );

CREATE POLICY "office_clearances_delete_admin"
  ON public.office_clearances FOR DELETE
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(),'admin'::app_role)
  );

CREATE TRIGGER trg_office_clearances_updated_at
  BEFORE UPDATE ON public.office_clearances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();