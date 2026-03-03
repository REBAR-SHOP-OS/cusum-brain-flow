
-- ============================================================
-- Phase 1A: Add lifecycle columns to orders
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_kind TEXT NOT NULL DEFAULT 'commercial',
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS expected_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_override BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for filtering by kind
CREATE INDEX IF NOT EXISTS idx_orders_order_kind ON public.orders(order_kind);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON public.orders(priority);

-- ============================================================
-- Phase 2: Hard gate triggers
-- ============================================================

-- 2A. Block quote_sent without customer
CREATE OR REPLACE FUNCTION public.block_quote_without_customer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'quote_sent' AND NEW.customer_id IS NULL THEN
    RAISE EXCEPTION 'Cannot send quote: no customer assigned';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_quote_without_customer ON public.orders;
CREATE TRIGGER trg_block_quote_without_customer
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.block_quote_without_customer();

-- 2B. Block approved without price
CREATE OR REPLACE FUNCTION public.block_approved_without_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND (NEW.total_amount IS NULL OR NEW.total_amount = 0) THEN
    RAISE EXCEPTION 'Cannot approve order: total_amount must be greater than zero';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_approved_without_price ON public.orders;
CREATE TRIGGER trg_block_approved_without_price
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.block_approved_without_price();

-- 2C. Block delivery scheduling without driver/vehicle/date
CREATE OR REPLACE FUNCTION public.block_delivery_without_schedule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('scheduled', 'in-transit')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('scheduled', 'in-transit')) THEN
    IF NEW.driver_name IS NULL OR NEW.vehicle IS NULL OR NEW.scheduled_date IS NULL THEN
      RAISE EXCEPTION 'Cannot schedule delivery: driver_name, vehicle, and scheduled_date are all required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_delivery_without_schedule ON public.deliveries;
CREATE TRIGGER trg_block_delivery_without_schedule
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.block_delivery_without_schedule();

-- 2D. Block ready unless production complete (or override)
CREATE OR REPLACE FUNCTION public.block_ready_without_production()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _incomplete INT;
BEGIN
  IF NEW.status = 'ready'
     AND (OLD.status IS NULL OR OLD.status != 'ready')
     AND NEW.production_override = FALSE THEN
    SELECT COUNT(*) INTO _incomplete
    FROM public.cut_plan_items cpi
    JOIN public.work_orders wo ON wo.id = cpi.work_order_id
    WHERE wo.order_id = NEW.id
      AND cpi.phase NOT IN ('complete', 'clearance');

    IF _incomplete > 0 THEN
      RAISE EXCEPTION 'Cannot mark ready: % cut plan item(s) not yet complete. Use production_override to bypass.', _incomplete;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_ready_without_production ON public.orders;
CREATE TRIGGER trg_block_ready_without_production
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.block_ready_without_production();

-- ============================================================
-- Phase 5A: Auto-triage on order creation
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_triage_new_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.order_kind = 'extract' THEN
    IF NEW.customer_id IS NULL THEN
      NEW.status := 'needs_customer';
    ELSIF NEW.total_amount IS NULL OR NEW.total_amount = 0 THEN
      NEW.status := 'needs_pricing';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_triage_new_order ON public.orders;
CREATE TRIGGER trg_auto_triage_new_order
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_triage_new_order();

-- ============================================================
-- Phase 5B: Auto-create delivery on delivery_staged
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_create_delivery_on_staged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _delivery_id UUID;
BEGIN
  IF NEW.status = 'delivery_staged'
     AND OLD.status != 'delivery_staged'
     AND NEW.delivery_method = 'delivery' THEN

    -- Check if a delivery already exists for this order
    IF NOT EXISTS (
      SELECT 1 FROM public.delivery_stops ds
      JOIN public.deliveries d ON d.id = ds.delivery_id
      WHERE ds.order_id = NEW.id AND d.status NOT IN ('cancelled', 'delivered')
    ) THEN
      INSERT INTO public.deliveries (company_id, status)
      VALUES (NEW.company_id, 'planned')
      RETURNING id INTO _delivery_id;

      INSERT INTO public.delivery_stops (delivery_id, order_id, stop_order)
      VALUES (_delivery_id, NEW.id, 1);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_delivery_on_staged ON public.orders;
CREATE TRIGGER trg_auto_create_delivery_on_staged
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_delivery_on_staged();
