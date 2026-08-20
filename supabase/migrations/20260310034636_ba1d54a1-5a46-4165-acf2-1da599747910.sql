
-- Phase 3 Migration 3: delivery_bundles junction table
CREATE TABLE public.delivery_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  bundle_id uuid NOT NULL REFERENCES public.bundles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.delivery_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view delivery_bundles" ON public.delivery_bundles
  FOR SELECT TO authenticated USING (
    delivery_id IN (SELECT id FROM deliveries WHERE company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()))
  );
CREATE POLICY "Company members can insert delivery_bundles" ON public.delivery_bundles
  FOR INSERT TO authenticated WITH CHECK (
    delivery_id IN (SELECT id FROM deliveries WHERE company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()))
  );

CREATE UNIQUE INDEX idx_delivery_bundles_dedup ON public.delivery_bundles(delivery_id, bundle_id);
CREATE INDEX idx_delivery_bundles_bundle ON public.delivery_bundles(bundle_id);

-- Enable realtime for bend_batches and bundles
ALTER PUBLICATION supabase_realtime ADD TABLE public.bend_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bundles;
