-- Vendor user links (mirrors customer_user_links pattern)
CREATE TABLE public.vendor_user_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, vendor_id)
);

ALTER TABLE public.vendor_user_links ENABLE ROW LEVEL SECURITY;

-- Users can see their own vendor links
CREATE POLICY "Users can view own vendor links"
  ON public.vendor_user_links FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can manage vendor links
CREATE POLICY "Admins can manage vendor links"
  ON public.vendor_user_links FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));