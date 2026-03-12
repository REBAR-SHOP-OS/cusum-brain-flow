
CREATE TABLE public.ad_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled Ad',
  brand_name text,
  script text,
  segments jsonb DEFAULT '[]'::jsonb,
  storyboard jsonb DEFAULT '[]'::jsonb,
  clips jsonb DEFAULT '[]'::jsonb,
  continuity jsonb,
  final_video_url text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ad projects"
  ON public.ad_projects FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
