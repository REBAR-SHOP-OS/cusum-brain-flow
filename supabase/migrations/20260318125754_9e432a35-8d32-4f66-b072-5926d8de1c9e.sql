
CREATE TABLE IF NOT EXISTS public.purchasing_confirmed_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TEXT NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchasing_confirmed_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcl_select"
  ON public.purchasing_confirmed_lists
  FOR SELECT
  TO authenticated
  USING (
    company_id::text IN (
      SELECT p.company_id::text FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "pcl_insert"
  ON public.purchasing_confirmed_lists
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id::text IN (
      SELECT p.company_id::text FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );
