
-- Link table: maps auth users with role=customer to a customer record
CREATE TABLE public.customer_user_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, customer_id)
);

ALTER TABLE public.customer_user_links ENABLE ROW LEVEL SECURITY;

-- Customers can read their own link
CREATE POLICY "Users read own customer links"
  ON public.customer_user_links FOR SELECT
  USING (auth.uid() = user_id);

-- Admins manage links
CREATE POLICY "Admins manage customer links"
  ON public.customer_user_links FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow customers to read their own orders via customer_user_links
CREATE POLICY "Customers read own orders"
  ON public.orders FOR SELECT
  USING (
    customer_id IN (
      SELECT customer_id FROM public.customer_user_links WHERE user_id = auth.uid()
    )
  );

-- Allow customers to read deliveries linked to their orders
CREATE POLICY "Customers read own deliveries"
  ON public.deliveries FOR SELECT
  USING (
    id IN (
      SELECT ds.delivery_id FROM public.delivery_stops ds
      JOIN public.orders o ON o.id = ds.order_id
      JOIN public.customer_user_links cul ON cul.customer_id = o.customer_id
      WHERE cul.user_id = auth.uid()
    )
  );

-- Allow customers to read delivery stops linked to their orders
CREATE POLICY "Customers read own delivery stops"
  ON public.delivery_stops FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      JOIN public.customer_user_links cul ON cul.customer_id = o.customer_id
      WHERE cul.user_id = auth.uid()
    )
  );
