
-- Create penny_collection_queue table
CREATE TABLE public.penny_collection_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  invoice_id text,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  amount numeric DEFAULT 0,
  days_overdue integer DEFAULT 0,
  action_type text NOT NULL,
  action_payload jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending_approval',
  priority text NOT NULL DEFAULT 'medium',
  ai_reasoning text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  executed_at timestamptz,
  execution_result jsonb,
  followup_date date,
  followup_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Validation trigger for status, priority, action_type
CREATE OR REPLACE FUNCTION public.validate_penny_queue_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending_approval', 'approved', 'executed', 'rejected', 'failed') THEN
    RAISE EXCEPTION 'Invalid penny_collection_queue status: %', NEW.status;
  END IF;
  IF NEW.priority NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Invalid penny_collection_queue priority: %', NEW.priority;
  END IF;
  IF NEW.action_type NOT IN ('email_reminder', 'call_collection', 'send_invoice', 'escalate') THEN
    RAISE EXCEPTION 'Invalid penny_collection_queue action_type: %', NEW.action_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_penny_queue
BEFORE INSERT OR UPDATE ON public.penny_collection_queue
FOR EACH ROW EXECUTE FUNCTION public.validate_penny_queue_fields();

-- Enable RLS
ALTER TABLE public.penny_collection_queue ENABLE ROW LEVEL SECURITY;

-- RLS: accounting or admin role, scoped by company_id
CREATE POLICY "Users with accounting/admin can view queue"
ON public.penny_collection_queue
FOR SELECT
TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin', 'accounting']::app_role[])
);

CREATE POLICY "Users with accounting/admin can insert queue"
ON public.penny_collection_queue
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin', 'accounting']::app_role[])
);

CREATE POLICY "Users with accounting/admin can update queue"
ON public.penny_collection_queue
FOR UPDATE
TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin', 'accounting']::app_role[])
);

CREATE POLICY "Service role full access to penny queue"
ON public.penny_collection_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.penny_collection_queue;

-- Index for common queries
CREATE INDEX idx_penny_queue_status_company ON public.penny_collection_queue (company_id, status);
CREATE INDEX idx_penny_queue_invoice_status ON public.penny_collection_queue (invoice_id, status);
