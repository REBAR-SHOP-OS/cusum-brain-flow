-- ============================================================
-- Phase 1: State Machine + Pricing Guard for Sales Quotations
-- ============================================================

-- 1. Add state machine, versioning, pricing failure, and audit columns to sales_quotations
ALTER TABLE public.sales_quotations
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_version_id uuid REFERENCES public.sales_quotations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS pricing_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pricing_failure_reason text,
  ADD COLUMN IF NOT EXISTS pricing_failure_details jsonb,
  ADD COLUMN IF NOT EXISTS estimate_request jsonb,
  ADD COLUMN IF NOT EXISTS quote_result jsonb,
  ADD COLUMN IF NOT EXISTS total_tonnage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scrap_percent numeric DEFAULT 15,
  ADD COLUMN IF NOT EXISTS tonnage_bracket text,
  ADD COLUMN IF NOT EXISTS internal_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_approved_by uuid,
  ADD COLUMN IF NOT EXISTS internal_approval_note text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_version integer,
  ADD COLUMN IF NOT EXISTS pdf_viewed_internally boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pdf_viewed_by_customer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_approved_by text,
  ADD COLUMN IF NOT EXISTS customer_approval_version integer,
  ADD COLUMN IF NOT EXISTS valid_until date,
  ADD COLUMN IF NOT EXISTS revision_reason text,
  ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assumptions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- 2. Create quote_audit_log table for tracking all transitions and events
CREATE TABLE IF NOT EXISTS public.quote_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.sales_quotations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  event_type text NOT NULL,
  previous_value text,
  new_value text,
  performed_by uuid,
  performed_by_name text,
  metadata jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on quote_audit_log
ALTER TABLE public.quote_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can read audit logs for their company
CREATE POLICY "Users can read own company audit logs"
  ON public.quote_audit_log FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
  ));

-- RLS policy: users can insert audit logs for their company
CREATE POLICY "Users can insert own company audit logs"
  ON public.quote_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
  ));

-- 3. Create validation trigger to block $0 quotes from being marked as approved
CREATE OR REPLACE FUNCTION public.validate_quotation_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed_from text[];
BEGIN
  -- Only validate on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Define allowed transitions
  CASE NEW.status
    WHEN 'draft' THEN
      allowed_from := ARRAY['pricing_failed', 'internal_revision_requested', 'customer_revision_requested', 'expired'];
    WHEN 'pricing_in_progress' THEN
      allowed_from := ARRAY['draft', 'pricing_failed'];
    WHEN 'pricing_failed' THEN
      allowed_from := ARRAY['pricing_in_progress', 'draft'];
    WHEN 'quote_ready' THEN
      allowed_from := ARRAY['pricing_in_progress', 'draft'];
    WHEN 'awaiting_internal_review' THEN
      allowed_from := ARRAY['quote_ready'];
    WHEN 'internal_revision_requested' THEN
      allowed_from := ARRAY['awaiting_internal_review'];
    WHEN 'internally_approved' THEN
      allowed_from := ARRAY['awaiting_internal_review'];
    WHEN 'sent_to_customer' THEN
      allowed_from := ARRAY['internally_approved'];
    WHEN 'customer_approved' THEN
      allowed_from := ARRAY['sent_to_customer'];
    WHEN 'customer_revision_requested' THEN
      allowed_from := ARRAY['sent_to_customer'];
    WHEN 'customer_rejected' THEN
      allowed_from := ARRAY['sent_to_customer'];
    WHEN 'expired' THEN
      allowed_from := ARRAY['draft', 'quote_ready', 'awaiting_internal_review', 'internally_approved', 'sent_to_customer'];
    WHEN 'cancelled' THEN
      -- Can cancel from any non-terminal state
      allowed_from := ARRAY['draft', 'pricing_in_progress', 'pricing_failed', 'quote_ready', 'awaiting_internal_review', 'internal_revision_requested', 'internally_approved', 'sent_to_customer', 'customer_revision_requested', 'expired'];
    ELSE
      -- Unknown status - allow for backward compat with old statuses (sent, accepted, declined)
      RETURN NEW;
  END CASE;

  IF NOT (OLD.status = ANY(allowed_from)) THEN
    RAISE EXCEPTION 'Invalid quotation status transition: % → %. Allowed from: %', OLD.status, NEW.status, array_to_string(allowed_from, ', ');
  END IF;

  -- Block approval if amount is 0 or null (the $0 quote bug fix)
  IF NEW.status = 'internally_approved' AND (NEW.amount IS NULL OR NEW.amount <= 0) THEN
    RAISE EXCEPTION 'Cannot approve quotation with $0 or missing amount. Pricing must succeed first.';
  END IF;

  -- Block sending to customer without internal approval
  IF NEW.status = 'sent_to_customer' AND OLD.status != 'internally_approved' THEN
    RAISE EXCEPTION 'Cannot send to customer without internal approval.';
  END IF;

  -- Block customer approval without PDF being viewed
  IF NEW.status = 'customer_approved' AND NEW.pdf_viewed_by_customer = false THEN
    RAISE EXCEPTION 'Customer must view the PDF before approving the quotation.';
  END IF;

  -- Block internal approval without PDF being viewed
  IF NEW.status = 'internally_approved' AND NEW.pdf_viewed_internally = false THEN
    RAISE EXCEPTION 'Internal reviewer must view the PDF before approving.';
  END IF;

  -- Auto-update updated_at
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

-- Drop if exists to avoid conflict
DROP TRIGGER IF EXISTS trg_validate_quotation_status ON public.sales_quotations;

CREATE TRIGGER trg_validate_quotation_status
  BEFORE UPDATE ON public.sales_quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_quotation_status_transition();

-- 4. Create trigger to auto-log status changes to audit log
CREATE OR REPLACE FUNCTION public.log_quotation_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.quote_audit_log (quotation_id, company_id, event_type, previous_value, new_value, performed_by, metadata)
    VALUES (
      NEW.id,
      NEW.company_id,
      'status_change',
      OLD.status,
      NEW.status,
      NEW.updated_by,
      jsonb_build_object(
        'version', NEW.version_number,
        'amount', NEW.amount,
        'pricing_status', NEW.pricing_status
      )
    );
  END IF;

  -- Log pricing status changes
  IF OLD.pricing_status IS DISTINCT FROM NEW.pricing_status THEN
    INSERT INTO public.quote_audit_log (quotation_id, company_id, event_type, previous_value, new_value, performed_by, metadata)
    VALUES (
      NEW.id,
      NEW.company_id,
      'pricing_status_change',
      OLD.pricing_status,
      NEW.pricing_status,
      NEW.updated_by,
      CASE WHEN NEW.pricing_status = 'failed' THEN
        jsonb_build_object('failure_reason', NEW.pricing_failure_reason, 'failure_details', NEW.pricing_failure_details)
      ELSE
        jsonb_build_object('amount', NEW.amount, 'tonnage', NEW.total_tonnage)
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_quotation_status ON public.sales_quotations;

CREATE TRIGGER trg_log_quotation_status
  AFTER UPDATE ON public.sales_quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_quotation_status_change();

-- 5. Index for audit log performance
CREATE INDEX IF NOT EXISTS idx_quote_audit_log_quotation ON public.quote_audit_log(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quote_audit_log_company ON public.quote_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotations_status ON public.sales_quotations(status);
CREATE INDEX IF NOT EXISTS idx_sales_quotations_company_status ON public.sales_quotations(company_id, status);