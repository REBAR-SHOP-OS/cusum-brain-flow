-- R9-2: Change 4 RESTRICT FKs on leads child tables to SET NULL
-- This allows lead deletion without FK violations

ALTER TABLE public.barlists
  DROP CONSTRAINT IF EXISTS barlists_lead_id_fkey,
  ADD CONSTRAINT barlists_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.communications
  DROP CONSTRAINT IF EXISTS communications_lead_id_fkey,
  ADD CONSTRAINT communications_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.estimation_learnings
  DROP CONSTRAINT IF EXISTS estimation_learnings_lead_id_fkey,
  ADD CONSTRAINT estimation_learnings_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.project_coordination_log
  DROP CONSTRAINT IF EXISTS project_coordination_log_lead_id_fkey,
  ADD CONSTRAINT project_coordination_log_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;