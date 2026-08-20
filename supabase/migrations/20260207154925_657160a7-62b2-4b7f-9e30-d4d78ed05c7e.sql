
-- ============================================================
-- 1. PROJECTS TABLE  (company → many projects)
-- ============================================================
CREATE TABLE public.projects (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID NOT NULL,
  name        TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  site_address TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  notes       TEXT,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects in company"
  ON public.projects FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admin/office can insert projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'sales'::app_role]));

CREATE POLICY "Admin/office can update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'sales'::app_role]));

CREATE POLICY "Admin can delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 2. BARLISTS TABLE  (project → many barlists)
-- ============================================================
CREATE TABLE public.barlists (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id       UUID NOT NULL,
  project_id       UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  source_type      TEXT NOT NULL DEFAULT 'manual',   -- manual, ai_extract, import
  revision_no      INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'draft',     -- draft, extracted, mapped, validated, approved, in_production, completed, rejected
  parent_barlist_id UUID REFERENCES public.barlists(id),
  extract_session_id UUID REFERENCES public.extract_sessions(id),
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.barlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view barlists in company"
  ON public.barlists FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admin/office can insert barlists"
  ON public.barlists FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]));

CREATE POLICY "Admin/office can update barlists"
  ON public.barlists FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]));

CREATE POLICY "Admin can delete barlists"
  ON public.barlists FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 3. BARLIST_ITEMS TABLE  (barlist → many items)
-- ============================================================
CREATE TABLE public.barlist_items (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barlist_id       UUID NOT NULL REFERENCES public.barlists(id) ON DELETE CASCADE,
  mark             TEXT,
  qty              INTEGER NOT NULL DEFAULT 0,
  bar_code         TEXT REFERENCES public.rebar_sizes(bar_code),
  grade            TEXT,
  shape_code       TEXT,
  cut_length_mm    INTEGER,
  dims_json        JSONB DEFAULT '{}',
  weight_kg        NUMERIC,
  drawing_ref      TEXT,
  notes            TEXT,
  source_row_id    UUID REFERENCES public.extract_rows(id),
  status           TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, in_production, completed
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.barlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view barlist items via barlist company"
  ON public.barlist_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barlists b
    WHERE b.id = barlist_items.barlist_id
      AND b.company_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Admin/office can insert barlist items"
  ON public.barlist_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.barlists b
    WHERE b.id = barlist_items.barlist_id
      AND b.company_id = get_user_company_id(auth.uid())
      AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
  ));

CREATE POLICY "Admin/office can update barlist items"
  ON public.barlist_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barlists b
    WHERE b.id = barlist_items.barlist_id
      AND b.company_id = get_user_company_id(auth.uid())
      AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
  ));

CREATE POLICY "Admin can delete barlist items"
  ON public.barlist_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barlists b
    WHERE b.id = barlist_items.barlist_id
      AND b.company_id = get_user_company_id(auth.uid())
      AND has_role(auth.uid(), 'admin'::app_role)
  ));

-- ============================================================
-- 4. ADD barlist_id TO EXISTING TABLES
-- ============================================================

-- production_tasks
ALTER TABLE public.production_tasks
  ADD COLUMN barlist_id UUID REFERENCES public.barlists(id);

-- machine_queue_items
ALTER TABLE public.machine_queue_items
  ADD COLUMN barlist_id UUID REFERENCES public.barlists(id);

-- work_orders  (link WO back to the barlist + project)
ALTER TABLE public.work_orders
  ADD COLUMN barlist_id  UUID REFERENCES public.barlists(id),
  ADD COLUMN project_id  UUID REFERENCES public.projects(id);

-- cut_plans  (add project_id FK to new projects table)
ALTER TABLE public.cut_plans
  ADD COLUMN project_id UUID REFERENCES public.projects(id);

-- ============================================================
-- 5. INDEXES
-- ============================================================
CREATE INDEX idx_projects_company   ON public.projects(company_id);
CREATE INDEX idx_barlists_project   ON public.barlists(project_id);
CREATE INDEX idx_barlists_company   ON public.barlists(company_id);
CREATE INDEX idx_barlist_items_barlist ON public.barlist_items(barlist_id);
CREATE INDEX idx_production_tasks_barlist ON public.production_tasks(barlist_id);
CREATE INDEX idx_machine_queue_barlist ON public.machine_queue_items(barlist_id);

-- ============================================================
-- 6. REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.barlists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.barlist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

-- ============================================================
-- 7. UPDATED_AT TRIGGER
-- ============================================================
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_barlists_updated_at
  BEFORE UPDATE ON public.barlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
