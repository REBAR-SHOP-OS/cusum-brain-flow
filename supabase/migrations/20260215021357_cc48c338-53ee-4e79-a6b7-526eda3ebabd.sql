
-- Create quote_requests table for website chat leads
CREATE TABLE public.quote_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  project_name TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'website_chat',
  chat_transcript JSONB,
  company_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS but no user policies (service role insert only from edge function)
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users with admin/office/sales roles to read
CREATE POLICY "Staff can view quote requests"
ON public.quote_requests FOR SELECT
USING (
  public.has_any_role(auth.uid(), ARRAY['admin', 'office', 'sales']::app_role[])
);

-- Allow authenticated staff to update status
CREATE POLICY "Staff can update quote requests"
ON public.quote_requests FOR UPDATE
USING (
  public.has_any_role(auth.uid(), ARRAY['admin', 'office', 'sales']::app_role[])
);

-- Validate status values
CREATE OR REPLACE FUNCTION public.validate_quote_request_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('new', 'reviewed', 'converted', 'declined') THEN
    RAISE EXCEPTION 'Invalid quote_request status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_quote_request_status_trigger
BEFORE INSERT OR UPDATE ON public.quote_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_quote_request_status();

-- Notification trigger: create activity_event when a new quote request arrives
CREATE OR REPLACE FUNCTION public.notify_quote_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.activity_events (
    company_id,
    entity_type,
    entity_id,
    event_type,
    description,
    actor_type,
    source,
    metadata
  ) VALUES (
    NEW.company_id,
    'quote_request',
    NEW.id::text,
    'quote_request_created',
    'New website quote request ' || NEW.quote_number || ' from ' || NEW.customer_name,
    'system',
    'website_chat',
    jsonb_build_object(
      'quote_number', NEW.quote_number,
      'customer_name', NEW.customer_name,
      'customer_email', NEW.customer_email,
      'items', NEW.items
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_new_quote_request
AFTER INSERT ON public.quote_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_quote_request();

-- Sequence for quote numbers
CREATE SEQUENCE IF NOT EXISTS public.quote_request_seq START 1;
