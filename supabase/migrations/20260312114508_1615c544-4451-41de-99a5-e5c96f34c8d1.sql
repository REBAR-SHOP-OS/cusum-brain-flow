
CREATE TABLE IF NOT EXISTS public.render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  scene_count int DEFAULT 0,
  completed_scenes int DEFAULT 0,
  voice_url text,
  music_url text,
  final_video_url text,
  final_file_size bigint,
  error_message text,
  error_stage text,
  render_log jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own render jobs" ON public.render_jobs
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
