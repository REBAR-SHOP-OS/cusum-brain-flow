
-- =================================================================
-- Shop Floor v2 – cut_plan_items new columns
-- =================================================================
ALTER TABLE public.cut_plan_items
  ADD COLUMN IF NOT EXISTS mark_number text,
  ADD COLUMN IF NOT EXISTS drawing_ref text,
  ADD COLUMN IF NOT EXISTS bend_type text NOT NULL DEFAULT 'straight',
  ADD COLUMN IF NOT EXISTS asa_shape_code text,
  ADD COLUMN IF NOT EXISTS total_pieces integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completed_pieces integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS needs_fix boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bend_dimensions jsonb,
  ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id);

-- =================================================================
-- cut_plans new columns
-- =================================================================
ALTER TABLE public.cut_plans
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS machine_id uuid REFERENCES public.machines(id);

-- =================================================================
-- pickup_orders table
-- =================================================================
CREATE TABLE IF NOT EXISTS public.pickup_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  customer_id uuid REFERENCES public.customers(id),
  site_address text NOT NULL,
  bundle_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  signature_data text,
  authorized_by uuid,
  authorized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pickup_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pickup_orders in their company"
  ON public.pickup_orders FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins and workshop can insert pickup_orders"
  ON public.pickup_orders FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
  );

CREATE POLICY "Admins and workshop can update pickup_orders"
  ON public.pickup_orders FOR UPDATE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
  );

CREATE POLICY "Admins can delete pickup_orders"
  ON public.pickup_orders FOR DELETE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- =================================================================
-- pickup_order_items table
-- =================================================================
CREATE TABLE IF NOT EXISTS public.pickup_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pickup_order_id uuid NOT NULL REFERENCES public.pickup_orders(id) ON DELETE CASCADE,
  mark_number text NOT NULL,
  description text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pickup_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pickup_order_items in their company"
  ON public.pickup_order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pickup_orders po
      WHERE po.id = pickup_order_items.pickup_order_id
        AND po.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Admins and workshop can insert pickup_order_items"
  ON public.pickup_order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pickup_orders po
      WHERE po.id = pickup_order_items.pickup_order_id
        AND po.company_id = get_user_company_id(auth.uid())
    )
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
  );

CREATE POLICY "Admins and workshop can update pickup_order_items"
  ON public.pickup_order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pickup_orders po
      WHERE po.id = pickup_order_items.pickup_order_id
        AND po.company_id = get_user_company_id(auth.uid())
    )
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
  );

CREATE POLICY "Admins can delete pickup_order_items"
  ON public.pickup_order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pickup_orders po
      WHERE po.id = pickup_order_items.pickup_order_id
        AND po.company_id = get_user_company_id(auth.uid())
    )
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Enable realtime for production updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.cut_plan_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pickup_orders;
