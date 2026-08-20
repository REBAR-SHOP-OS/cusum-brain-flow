
-- Create wp_change_log table for WordPress audit trail
CREATE TABLE public.wp_change_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  result TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wp_change_log ENABLE ROW LEVEL SECURITY;

-- Admin-only read access
CREATE POLICY "Admins can read wp_change_log"
ON public.wp_change_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin-only insert (edge function uses service role, but allow admin insert too)
CREATE POLICY "Admins can insert wp_change_log"
ON public.wp_change_log
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Index for quick lookups
CREATE INDEX idx_wp_change_log_entity ON public.wp_change_log (entity_type, entity_id);
CREATE INDEX idx_wp_change_log_created ON public.wp_change_log (created_at DESC);
