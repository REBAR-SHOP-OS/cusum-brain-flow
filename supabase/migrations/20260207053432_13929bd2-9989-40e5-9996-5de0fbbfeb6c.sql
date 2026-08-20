
-- =============================================
-- CUT PLANS
-- =============================================
CREATE TABLE public.cut_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Status validation trigger (not CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_cut_plan_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'queued', 'running', 'completed', 'canceled') THEN
    RAISE EXCEPTION 'Invalid cut_plan status: %. Allowed: draft, queued, running, completed, canceled', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_cut_plan_status
BEFORE INSERT OR UPDATE ON public.cut_plans
FOR EACH ROW EXECUTE FUNCTION public.validate_cut_plan_status();

-- Auto-update updated_at
CREATE TRIGGER update_cut_plans_updated_at
BEFORE UPDATE ON public.cut_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.cut_plans ENABLE ROW LEVEL SECURITY;

-- SELECT: company match (office gets read-only via this)
CREATE POLICY "Users can view cut_plans in their company"
ON public.cut_plans FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

-- INSERT: admin + workshop only
CREATE POLICY "Admins and workshop can insert cut_plans"
ON public.cut_plans FOR INSERT
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
);

-- UPDATE: admin + workshop only
CREATE POLICY "Admins and workshop can update cut_plans"
ON public.cut_plans FOR UPDATE
USING (
  company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
);

-- DELETE: admin only
CREATE POLICY "Admins can delete cut_plans"
ON public.cut_plans FOR DELETE
USING (
  company_id = get_user_company_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- =============================================
-- CUT PLAN ITEMS
-- =============================================
CREATE TABLE public.cut_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cut_plan_id uuid NOT NULL REFERENCES public.cut_plans(id) ON DELETE CASCADE,
  bar_code text NOT NULL REFERENCES public.rebar_sizes(bar_code),
  qty_bars int NOT NULL,
  cut_length_mm int NOT NULL,
  pieces_per_bar int NOT NULL DEFAULT 1,
  notes text NULL
);

-- RLS
ALTER TABLE public.cut_plan_items ENABLE ROW LEVEL SECURITY;

-- SELECT: via parent company
CREATE POLICY "Users can view cut_plan_items in their company"
ON public.cut_plan_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.cut_plans cp
  WHERE cp.id = cut_plan_items.cut_plan_id
  AND cp.company_id = get_user_company_id(auth.uid())
));

-- INSERT: admin + workshop
CREATE POLICY "Admins and workshop can insert cut_plan_items"
ON public.cut_plan_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cut_plans cp
    WHERE cp.id = cut_plan_items.cut_plan_id
    AND cp.company_id = get_user_company_id(auth.uid())
  )
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
);

-- UPDATE: admin + workshop
CREATE POLICY "Admins and workshop can update cut_plan_items"
ON public.cut_plan_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.cut_plans cp
    WHERE cp.id = cut_plan_items.cut_plan_id
    AND cp.company_id = get_user_company_id(auth.uid())
  )
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
);

-- DELETE: admin + workshop
CREATE POLICY "Admins and workshop can delete cut_plan_items"
ON public.cut_plan_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.cut_plans cp
    WHERE cp.id = cut_plan_items.cut_plan_id
    AND cp.company_id = get_user_company_id(auth.uid())
  )
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
);
