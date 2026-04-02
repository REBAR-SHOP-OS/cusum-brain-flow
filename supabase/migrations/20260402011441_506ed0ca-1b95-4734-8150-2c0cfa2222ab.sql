CREATE TABLE public.workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text,
  timezone text NOT NULL DEFAULT 'America/Toronto',
  date_format text NOT NULL DEFAULT 'MM/dd/yyyy',
  time_format text NOT NULL DEFAULT '12h',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read workspace_settings"
  ON public.workspace_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update workspace_settings"
  ON public.workspace_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.workspace_settings (timezone, date_format, time_format)
  VALUES ('America/Toronto', 'MM/dd/yyyy', '12h');