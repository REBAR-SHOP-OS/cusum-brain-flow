
-- ═══════════════════════════════════════════════════════════════
-- Step 1: Create order_items table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  bar_size TEXT,
  length_mm NUMERIC,
  shape TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by order
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);

-- Auto-update updated_at
CREATE TRIGGER update_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- Step 2: RLS on order_items (scoped via order's company_id)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view order items in their company"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can insert order items in their company"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can update order items in their company"
  ON public.order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can delete order items in their company"
  ON public.order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- Step 3: Order status validation trigger
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_order_status()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'confirmed', 'in_production', 'invoiced', 'partially_paid', 'paid', 'closed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid order status: %. Allowed: pending, confirmed, in_production, invoiced, partially_paid, paid, closed, cancelled', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_order_status_trigger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_status();

-- ═══════════════════════════════════════════════════════════════
-- Step 4: Auto-recalculate orders.total_amount when items change
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.recalc_order_total()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _order_id UUID;
  _total NUMERIC;
BEGIN
  _order_id := COALESCE(NEW.order_id, OLD.order_id);
  SELECT COALESCE(SUM(quantity * unit_price), 0) INTO _total
    FROM public.order_items
    WHERE order_id = _order_id;
  UPDATE public.orders SET total_amount = _total WHERE id = _order_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER recalc_order_total_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_order_total();
