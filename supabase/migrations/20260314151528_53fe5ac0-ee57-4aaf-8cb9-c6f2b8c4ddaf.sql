
CREATE TABLE public.cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  camera_id text NOT NULL,
  name text NOT NULL,
  ip_address text NOT NULL,
  port integer NOT NULL DEFAULT 554,
  username text NOT NULL DEFAULT 'admin',
  password text,
  rtsp_path text NOT NULL DEFAULT '/h264Preview_01_main',
  location text,
  assigned_zone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own company cameras"
  ON public.cameras FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users insert own company cameras"
  ON public.cameras FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users update own company cameras"
  ON public.cameras FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users delete own company cameras"
  ON public.cameras FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
