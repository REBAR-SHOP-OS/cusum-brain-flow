
-- ===================================================================
-- Phase 1: Shop Drawing QC, Revision Control & SLA System
-- ===================================================================

-- A) Orders table – shop drawing & safety lock columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shop_drawing_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS customer_revision_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billable_revision_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS qc_internal_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS production_locked BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pending_change_order BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS qc_final_approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS qc_evidence_uploaded BOOLEAN NOT NULL DEFAULT FALSE;

-- B) Leads table – SLA tracking columns
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS escalated_to TEXT;

-- C) SLA escalation log table
CREATE TABLE IF NOT EXISTS public.sla_escalation_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  stage TEXT NOT NULL,
  sla_hours NUMERIC NOT NULL,
  breached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  escalated_to TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_escalation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view escalation logs"
  ON public.sla_escalation_log FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "System can insert escalation logs"
  ON public.sla_escalation_log FOR INSERT
  WITH CHECK (true);

-- D1) Validation trigger: shop_drawing_status
CREATE OR REPLACE FUNCTION public.validate_shop_drawing_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.shop_drawing_status NOT IN ('draft','qc_internal','sent_to_customer','customer_revision','approved') THEN
    RAISE EXCEPTION 'Invalid shop_drawing_status: %', NEW.shop_drawing_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_shop_drawing_status ON public.orders;
CREATE TRIGGER trg_validate_shop_drawing_status
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_shop_drawing_status();

-- D2) Auto-billable revision trigger
CREATE OR REPLACE FUNCTION public.auto_billable_revision()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.customer_revision_count >= 1
     AND OLD.customer_revision_count < 1
     AND NEW.billable_revision_required = FALSE THEN
    NEW.billable_revision_required := TRUE;
    NEW.pending_change_order := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_billable_revision ON public.orders;
CREATE TRIGGER trg_auto_billable_revision
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_billable_revision();

-- D3) Block production without approval
CREATE OR REPLACE FUNCTION public.block_production_without_approval()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  _order_id UUID;
  _sd_status TEXT;
  _pending_co BOOLEAN;
  _qc_approved TIMESTAMPTZ;
BEGIN
  -- Only check when phase transitions to cutting
  IF NEW.phase = 'cutting' AND (OLD.phase IS DISTINCT FROM 'cutting') THEN
    -- Resolve order_id via work_order
    IF NEW.work_order_id IS NOT NULL THEN
      SELECT wo.order_id INTO _order_id
        FROM public.work_orders wo WHERE wo.id = NEW.work_order_id;
    END IF;

    IF _order_id IS NOT NULL THEN
      SELECT shop_drawing_status, pending_change_order, qc_internal_approved_at
        INTO _sd_status, _pending_co, _qc_approved
        FROM public.orders WHERE id = _order_id;

      IF _sd_status != 'approved' THEN
        RAISE EXCEPTION 'Production blocked: shop drawing not approved (status: %)', _sd_status;
      END IF;
      IF _pending_co = TRUE THEN
        RAISE EXCEPTION 'Production blocked: pending change order';
      END IF;
      IF _qc_approved IS NULL THEN
        RAISE EXCEPTION 'Production blocked: QC internal approval missing';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_production_without_approval ON public.cut_plan_items;
CREATE TRIGGER trg_block_production_without_approval
  BEFORE UPDATE ON public.cut_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.block_production_without_approval();

-- D4) Block delivery without QC evidence
CREATE OR REPLACE FUNCTION public.block_delivery_without_qc()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  _missing BOOLEAN := FALSE;
BEGIN
  IF NEW.status IN ('loading', 'in_transit') AND OLD.status NOT IN ('loading', 'in_transit') THEN
    -- Check all orders linked via delivery_stops
    SELECT EXISTS (
      SELECT 1 FROM public.delivery_stops ds
      JOIN public.orders o ON o.id = ds.order_id
      WHERE ds.delivery_id = NEW.id
        AND (o.qc_evidence_uploaded = FALSE OR o.qc_final_approved = FALSE)
    ) INTO _missing;

    IF _missing THEN
      RAISE EXCEPTION 'Delivery blocked: QC evidence or final approval missing on linked orders';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_delivery_without_qc ON public.deliveries;
CREATE TRIGGER trg_block_delivery_without_qc
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.block_delivery_without_qc();

-- D5) Auto-set SLA deadline on lead stage change
CREATE OR REPLACE FUNCTION public.set_sla_deadline()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  _hours NUMERIC;
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    _hours := CASE NEW.stage
      WHEN 'new' THEN 24
      WHEN 'hot_enquiries' THEN 24
      WHEN 'telephonic_enquiries' THEN 24
      WHEN 'qualified' THEN 24
      WHEN 'estimation_ben' THEN 48
      WHEN 'estimation_karthick' THEN 48
      WHEN 'qc_ben' THEN 24
      WHEN 'shop_drawing' THEN 72
      WHEN 'shop_drawing_approval' THEN 120  -- 5 days
      WHEN 'quotation_priority' THEN 48
      WHEN 'quotation_bids' THEN 48
      WHEN 'rfi' THEN 48
      WHEN 'addendums' THEN 48
      ELSE NULL
    END;

    IF _hours IS NOT NULL THEN
      NEW.sla_deadline := now() + (_hours || ' hours')::interval;
      NEW.sla_breached := FALSE;
      NEW.escalated_to := NULL;
    ELSE
      NEW.sla_deadline := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_sla_deadline ON public.leads;
CREATE TRIGGER trg_set_sla_deadline
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_sla_deadline();
