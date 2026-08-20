
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================
-- Table: system_backups
-- =============================================
CREATE TABLE public.system_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_by_name text,
  status text NOT NULL DEFAULT 'pending',
  backup_type text NOT NULL DEFAULT 'manual',
  file_path text,
  file_size_bytes bigint,
  tables_backed_up text[],
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system_backups"
  ON public.system_backups FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert system_backups"
  ON public.system_backups FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update system_backups"
  ON public.system_backups FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: auto-delete backups older than 7 days or when count > 50
CREATE OR REPLACE FUNCTION public.cleanup_old_backups()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete rows older than 7 days
  DELETE FROM public.system_backups
  WHERE started_at < now() - interval '7 days';

  -- Keep only the latest 50 rows
  DELETE FROM public.system_backups
  WHERE id NOT IN (
    SELECT id FROM public.system_backups
    ORDER BY started_at DESC
    LIMIT 50
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_old_backups
  AFTER INSERT ON public.system_backups
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_backups();

-- =============================================
-- Table: backup_restore_logs
-- =============================================
CREATE TABLE public.backup_restore_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id uuid REFERENCES public.system_backups(id) ON DELETE SET NULL,
  performed_by uuid REFERENCES auth.users(id),
  performed_by_name text,
  action text NOT NULL,
  result text NOT NULL,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.backup_restore_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backup_restore_logs"
  ON public.backup_restore_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert backup_restore_logs"
  ON public.backup_restore_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- Storage bucket: system-backups (private)
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('system-backups', 'system-backups', false, 524288000, ARRAY['application/json', 'application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only service role can read/write (edge function uses service key)
CREATE POLICY "Service role can manage system-backups"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'system-backups')
  WITH CHECK (bucket_id = 'system-backups');
