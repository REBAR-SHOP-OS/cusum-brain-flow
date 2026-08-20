
-- ═══════════════════════════════════════════════════════════
-- Purchase Orders: PO Intake → Receiving → inventory_lots
-- ═══════════════════════════════════════════════════════════

-- Purchase orders from suppliers
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  po_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_delivery DATE,
  received_at TIMESTAMPTZ,
  received_by UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_purchase_order_status()
  RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft','submitted','partial','received','canceled') THEN
    RAISE EXCEPTION 'Invalid purchase_order status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_po_status
  BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_purchase_order_status();

-- Auto-update updated_at
CREATE TRIGGER trg_po_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view POs in their company"
  ON public.purchase_orders FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admin/office can insert POs"
  ON public.purchase_orders FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]));

CREATE POLICY "Admin/office can update POs"
  ON public.purchase_orders FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]));

CREATE POLICY "Admin can delete POs"
  ON public.purchase_orders FOR DELETE
  USING (company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_po_company_status ON public.purchase_orders (company_id, status);

-- ─── PO Line Items ──────────────────────────────────────────

CREATE TABLE public.purchase_order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  bar_code TEXT NOT NULL REFERENCES public.rebar_sizes(bar_code),
  standard_length_mm INTEGER NOT NULL DEFAULT 12000,
  qty_ordered INTEGER NOT NULL DEFAULT 0,
  qty_received INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_pol_updated_at
  BEFORE UPDATE ON public.purchase_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view PO lines via PO company"
  ON public.purchase_order_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_lines.purchase_order_id
      AND po.company_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Admin/office can insert PO lines"
  ON public.purchase_order_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_lines.purchase_order_id
      AND po.company_id = get_user_company_id(auth.uid())
      AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
  ));

CREATE POLICY "Admin/office can update PO lines"
  ON public.purchase_order_lines FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_lines.purchase_order_id
      AND po.company_id = get_user_company_id(auth.uid())
      AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
  ));

CREATE POLICY "Admin can delete PO lines"
  ON public.purchase_order_lines FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_lines.purchase_order_id
      AND po.company_id = get_user_company_id(auth.uid())
      AND has_role(auth.uid(), 'admin'::app_role)
  ));

CREATE INDEX idx_pol_po_id ON public.purchase_order_lines (purchase_order_id);
