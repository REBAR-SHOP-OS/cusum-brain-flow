
-- Create migration_logs table for tracking batch run results
CREATE TABLE public.migration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  migrated INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  remaining INT NOT NULL DEFAULT 0,
  elapsed_s NUMERIC NOT NULL DEFAULT 0,
  errors TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'success'
);

-- Enable RLS
ALTER TABLE public.migration_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "Admins can read migration logs"
  ON public.migration_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role inserts (no user-facing insert policy needed)
CREATE POLICY "Service role can insert migration logs"
  ON public.migration_logs FOR INSERT
  WITH CHECK (true);
