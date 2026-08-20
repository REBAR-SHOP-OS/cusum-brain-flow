
-- Purchase Order Items (line items for existing purchase_orders)
CREATE TABLE public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  received_qty NUMERIC NOT NULL DEFAULT 0,
  billed_qty NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Goods Receipts (when items physically arrive)
CREATE TABLE public.goods_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id),
  receipt_number TEXT NOT NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.goods_receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  po_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id),
  received_qty NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Three-way match records
CREATE TABLE public.three_way_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id),
  goods_receipt_id UUID REFERENCES public.goods_receipts(id),
  bill_quickbooks_id TEXT,
  match_status TEXT NOT NULL DEFAULT 'pending',
  qty_variance NUMERIC DEFAULT 0,
  price_variance NUMERIC DEFAULT 0,
  auto_matched BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_goods_receipt_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'confirmed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid goods_receipt status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_goods_receipt
BEFORE INSERT OR UPDATE ON public.goods_receipts
FOR EACH ROW EXECUTE FUNCTION public.validate_goods_receipt_status();

CREATE OR REPLACE FUNCTION public.validate_three_way_match_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.match_status NOT IN ('pending', 'matched', 'variance', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid match_status: %', NEW.match_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_three_way_match
BEFORE INSERT OR UPDATE ON public.three_way_matches
FOR EACH ROW EXECUTE FUNCTION public.validate_three_way_match_status();

-- Auto-generate receipt numbers
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _seq INT;
BEGIN
  SELECT COUNT(*) + 1 INTO _seq FROM public.goods_receipts WHERE company_id = NEW.company_id;
  NEW.receipt_number := 'GR-' || LPAD(_seq::text, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_receipt_number
BEFORE INSERT ON public.goods_receipts
FOR EACH ROW EXECUTE FUNCTION public.generate_receipt_number();

-- Updated_at triggers
CREATE TRIGGER update_goods_receipts_updated_at BEFORE UPDATE ON public.goods_receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_three_way_matches_updated_at BEFORE UPDATE ON public.three_way_matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.three_way_matches ENABLE ROW LEVEL SECURITY;

-- PO Items: same company access
CREATE POLICY "Company users see po items" ON public.purchase_order_items FOR SELECT TO authenticated
USING (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Company users insert po items" ON public.purchase_order_items FOR INSERT TO authenticated
WITH CHECK (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Company users update po items" ON public.purchase_order_items FOR UPDATE TO authenticated
USING (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Company users delete po items" ON public.purchase_order_items FOR DELETE TO authenticated
USING (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

-- Goods Receipts: company access
CREATE POLICY "Company users see receipts" ON public.goods_receipts FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company users insert receipts" ON public.goods_receipts FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company users update receipts" ON public.goods_receipts FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- Receipt Items
CREATE POLICY "Company users see receipt items" ON public.goods_receipt_items FOR SELECT TO authenticated
USING (receipt_id IN (SELECT id FROM public.goods_receipts WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Company users insert receipt items" ON public.goods_receipt_items FOR INSERT TO authenticated
WITH CHECK (receipt_id IN (SELECT id FROM public.goods_receipts WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Company users delete receipt items" ON public.goods_receipt_items FOR DELETE TO authenticated
USING (receipt_id IN (SELECT id FROM public.goods_receipts WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

-- Three-way matches: admin/accounting only
CREATE POLICY "Admins see matches" ON public.three_way_matches FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accounting')));

CREATE POLICY "Admins insert matches" ON public.three_way_matches FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accounting')));

CREATE POLICY "Admins update matches" ON public.three_way_matches FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accounting')));
