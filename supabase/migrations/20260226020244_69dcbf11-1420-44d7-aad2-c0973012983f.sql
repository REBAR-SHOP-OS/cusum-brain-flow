
-- QA War Engine tables

CREATE TABLE public.qa_war_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  total_scenarios int NOT NULL DEFAULT 500,
  bugs_found int NOT NULL DEFAULT 0,
  summary jsonb,
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_war_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read qa_war_runs"
  ON public.qa_war_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert qa_war_runs"
  ON public.qa_war_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update qa_war_runs"
  ON public.qa_war_runs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.qa_war_bugs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.qa_war_runs(id) ON DELETE CASCADE,
  bug_id text NOT NULL,
  title text NOT NULL,
  module text NOT NULL,
  severity text NOT NULL,
  priority text NOT NULL,
  type text NOT NULL,
  steps_to_repro jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected text NOT NULL,
  actual text NOT NULL,
  suspected_root_cause text,
  fix_proposal text,
  scenario_category text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_war_bugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read qa_war_bugs"
  ON public.qa_war_bugs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert qa_war_bugs"
  ON public.qa_war_bugs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update qa_war_bugs"
  ON public.qa_war_bugs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_qa_war_bugs_run_id ON public.qa_war_bugs(run_id);
CREATE INDEX idx_qa_war_bugs_severity ON public.qa_war_bugs(severity);
CREATE INDEX idx_qa_war_bugs_module ON public.qa_war_bugs(module);
CREATE INDEX idx_qa_war_bugs_bug_id ON public.qa_war_bugs(bug_id);
