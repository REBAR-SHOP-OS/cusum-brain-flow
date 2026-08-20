
-- Create loading_checklist table for item-by-item truck loading verification
CREATE TABLE public.loading_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  cut_plan_id UUID NOT NULL REFERENCES public.cut_plans(id),
  cut_plan_item_id UUID NOT NULL REFERENCES public.cut_plan_items(id),
  loaded BOOLEAN NOT NULL DEFAULT false,
  photo_path TEXT,
  loaded_by UUID REFERENCES auth.users(id),
  loaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one checklist row per item per bundle
ALTER TABLE public.loading_checklist ADD CONSTRAINT loading_checklist_item_unique UNIQUE (cut_plan_id, cut_plan_item_id);

-- Enable RLS
ALTER TABLE public.loading_checklist ENABLE ROW LEVEL SECURITY;

-- RLS policies scoped by company_id
CREATE POLICY "Users can view loading checklist for their company"
  ON public.loading_checklist FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert loading checklist for their company"
  ON public.loading_checklist FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update loading checklist for their company"
  ON public.loading_checklist FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete loading checklist for their company"
  ON public.loading_checklist FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Index for fast lookups by bundle
CREATE INDEX idx_loading_checklist_cut_plan ON public.loading_checklist(cut_plan_id);
