
-- ============================================================
-- STEP 1: recompute_order_completion function
-- When all production_tasks for an order are complete,
-- set order status to 'ready' or 'delivery_staged'
-- ============================================================

CREATE OR REPLACE FUNCTION public.recompute_order_completion(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_complete int;
  v_delivery_method text;
  v_current_status text;
BEGIN
  IF p_order_id IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO v_total
  FROM production_tasks WHERE order_id = p_order_id;

  IF v_total = 0 THEN RETURN; END IF;

  SELECT count(*) INTO v_complete
  FROM production_tasks
  WHERE order_id = p_order_id
    AND status = 'complete';

  IF v_complete < v_total THEN
    -- Not all complete yet — ensure order is in_production if it was queued
    UPDATE orders
    SET status = 'in_production'
    WHERE id = p_order_id
      AND status IN ('queued_production', 'approved', 'extract_new');
    RETURN;
  END IF;

  -- All tasks complete
  SELECT delivery_method, status INTO v_delivery_method, v_current_status
  FROM orders WHERE id = p_order_id;

  -- Don't regress orders that are already past delivery_staged
  IF v_current_status IN ('scheduled', 'in_transit', 'delivered', 'invoiced', 'paid', 'archived') THEN
    RETURN;
  END IF;

  IF v_delivery_method = 'delivery' THEN
    UPDATE orders SET status = 'delivery_staged' WHERE id = p_order_id;
  ELSE
    UPDATE orders SET status = 'ready' WHERE id = p_order_id;
  END IF;
END;
$$;

-- ============================================================
-- STEP 2: Trigger on production_tasks to call recompute
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_recompute_order_on_task_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    PERFORM recompute_order_completion(NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_on_task_change ON public.production_tasks;
CREATE TRIGGER trg_recompute_on_task_change
  AFTER INSERT OR UPDATE ON public.production_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recompute_order_on_task_change();

-- ============================================================
-- STEP 3: Fix auto_create_delivery_on_staged trigger
-- Creates delivery with status='staged' when order becomes delivery_staged
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_create_delivery_on_staged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_del_exists boolean;
BEGIN
  IF NEW.status = 'delivery_staged' AND (OLD.status IS NULL OR OLD.status <> 'delivery_staged') THEN
    SELECT EXISTS(SELECT 1 FROM deliveries WHERE order_id = NEW.id) INTO v_del_exists;
    IF NOT v_del_exists THEN
      INSERT INTO deliveries (
        delivery_number, company_id, status, order_id
      ) VALUES (
        'DEL-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 4),
        NEW.company_id,
        'staged',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_create_delivery_on_staged ON public.orders;
CREATE TRIGGER auto_create_delivery_on_staged
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_delivery_on_staged();

-- ============================================================
-- STEP 4: Mirror delivery status → order status
-- ============================================================

CREATE OR REPLACE FUNCTION public.mirror_delivery_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  IF NEW.status = 'scheduled' THEN
    UPDATE orders SET status = 'scheduled' WHERE id = NEW.order_id
      AND status NOT IN ('in_transit', 'delivered', 'invoiced', 'paid', 'archived');
  ELSIF NEW.status = 'in-transit' THEN
    UPDATE orders SET status = 'in_transit' WHERE id = NEW.order_id
      AND status NOT IN ('delivered', 'invoiced', 'paid', 'archived');
  ELSIF NEW.status = 'delivered' THEN
    UPDATE orders SET status = 'delivered' WHERE id = NEW.order_id
      AND status NOT IN ('invoiced', 'paid', 'archived');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_delivery_to_order ON public.deliveries;
CREATE TRIGGER trg_mirror_delivery_to_order
  AFTER UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.mirror_delivery_to_order();
