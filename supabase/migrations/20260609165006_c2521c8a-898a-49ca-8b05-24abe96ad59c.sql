
-- =========================================================================
-- Intake pipeline isolation: add intake_id + project_id down the chain
-- =========================================================================

-- 1. Add columns (nullable, additive)
ALTER TABLE public.cut_plan_items    ADD COLUMN IF NOT EXISTS intake_id uuid REFERENCES public.barlists(id) ON DELETE SET NULL;
ALTER TABLE public.cut_plan_items    ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.bundles           ADD COLUMN IF NOT EXISTS intake_id uuid REFERENCES public.barlists(id) ON DELETE SET NULL;
ALTER TABLE public.bundles           ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.loading_checklist ADD COLUMN IF NOT EXISTS intake_id uuid REFERENCES public.barlists(id) ON DELETE SET NULL;
ALTER TABLE public.loading_checklist ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.packing_slips     ADD COLUMN IF NOT EXISTS intake_id uuid REFERENCES public.barlists(id) ON DELETE SET NULL;
ALTER TABLE public.packing_slips     ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.pickup_orders     ADD COLUMN IF NOT EXISTS intake_id uuid REFERENCES public.barlists(id) ON DELETE SET NULL;
ALTER TABLE public.pickup_orders     ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.pickup_order_items ADD COLUMN IF NOT EXISTS intake_id uuid REFERENCES public.barlists(id) ON DELETE SET NULL;
ALTER TABLE public.pickup_order_items ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.deliveries        ADD COLUMN IF NOT EXISTS intake_id uuid REFERENCES public.barlists(id) ON DELETE SET NULL;
ALTER TABLE public.deliveries        ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.delivery_stops    ADD COLUMN IF NOT EXISTS intake_id uuid REFERENCES public.barlists(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_stops    ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.delivery_bundles  ADD COLUMN IF NOT EXISTS intake_id uuid REFERENCES public.barlists(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_bundles  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.clearance_evidence ADD COLUMN IF NOT EXISTS intake_id uuid REFERENCES public.barlists(id) ON DELETE SET NULL;
ALTER TABLE public.clearance_evidence ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_cut_plan_items_intake     ON public.cut_plan_items(intake_id);
CREATE INDEX IF NOT EXISTS idx_cut_plan_items_proj_intake ON public.cut_plan_items(project_id, intake_id);
CREATE INDEX IF NOT EXISTS idx_bundles_intake            ON public.bundles(intake_id);
CREATE INDEX IF NOT EXISTS idx_loading_checklist_intake  ON public.loading_checklist(intake_id);
CREATE INDEX IF NOT EXISTS idx_packing_slips_intake      ON public.packing_slips(intake_id);
CREATE INDEX IF NOT EXISTS idx_pickup_orders_intake      ON public.pickup_orders(intake_id);
CREATE INDEX IF NOT EXISTS idx_pickup_order_items_intake ON public.pickup_order_items(intake_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_intake         ON public.deliveries(intake_id);
CREATE INDEX IF NOT EXISTS idx_delivery_stops_intake     ON public.delivery_stops(intake_id);
CREATE INDEX IF NOT EXISTS idx_delivery_bundles_intake   ON public.delivery_bundles(intake_id);
CREATE INDEX IF NOT EXISTS idx_clearance_evidence_intake ON public.clearance_evidence(intake_id);

-- =========================================================================
-- 3. Backfill from existing parent links (idempotent — only fill NULLs)
-- =========================================================================

-- cut_plan_items <- cut_plans
UPDATE public.cut_plan_items cpi
SET intake_id  = COALESCE(cpi.intake_id,  cp.barlist_id),
    project_id = COALESCE(cpi.project_id, cp.project_id)
FROM public.cut_plans cp
WHERE cpi.cut_plan_id = cp.id
  AND (cpi.intake_id IS NULL OR cpi.project_id IS NULL)
  AND (cp.barlist_id IS NOT NULL OR cp.project_id IS NOT NULL);

-- clearance_evidence <- cut_plan_items
UPDATE public.clearance_evidence ce
SET intake_id  = COALESCE(ce.intake_id,  cpi.intake_id),
    project_id = COALESCE(ce.project_id, cpi.project_id)
FROM public.cut_plan_items cpi
WHERE ce.cut_plan_item_id = cpi.id
  AND (ce.intake_id IS NULL OR ce.project_id IS NULL);

-- loading_checklist <- cut_plan_items (preferred) then cut_plans
UPDATE public.loading_checklist lc
SET intake_id  = COALESCE(lc.intake_id,  cpi.intake_id),
    project_id = COALESCE(lc.project_id, cpi.project_id)
FROM public.cut_plan_items cpi
WHERE lc.cut_plan_item_id = cpi.id
  AND (lc.intake_id IS NULL OR lc.project_id IS NULL);

UPDATE public.loading_checklist lc
SET intake_id  = COALESCE(lc.intake_id,  cp.barlist_id),
    project_id = COALESCE(lc.project_id, cp.project_id)
FROM public.cut_plans cp
WHERE lc.cut_plan_id = cp.id
  AND (lc.intake_id IS NULL OR lc.project_id IS NULL);

-- packing_slips <- cut_plans
UPDATE public.packing_slips ps
SET intake_id  = COALESCE(ps.intake_id,  cp.barlist_id),
    project_id = COALESCE(ps.project_id, cp.project_id)
FROM public.cut_plans cp
WHERE ps.cut_plan_id = cp.id
  AND (ps.intake_id IS NULL OR ps.project_id IS NULL);

-- deliveries <- cut_plans (when cut_plan_id present)
UPDATE public.deliveries d
SET intake_id  = COALESCE(d.intake_id,  cp.barlist_id),
    project_id = COALESCE(d.project_id, cp.project_id)
FROM public.cut_plans cp
WHERE d.cut_plan_id = cp.id
  AND (d.intake_id IS NULL OR d.project_id IS NULL);

-- delivery_stops <- deliveries
UPDATE public.delivery_stops ds
SET intake_id  = COALESCE(ds.intake_id,  d.intake_id),
    project_id = COALESCE(ds.project_id, d.project_id)
FROM public.deliveries d
WHERE ds.delivery_id = d.id
  AND (ds.intake_id IS NULL OR ds.project_id IS NULL);

-- delivery_bundles <- deliveries
UPDATE public.delivery_bundles db
SET intake_id  = COALESCE(db.intake_id,  d.intake_id),
    project_id = COALESCE(db.project_id, d.project_id)
FROM public.deliveries d
WHERE db.delivery_id = d.id
  AND (db.intake_id IS NULL OR db.project_id IS NULL);

-- bundles <- via source_cut_batch_id -> cut_batches.source_plan_id -> cut_plans
UPDATE public.bundles b
SET intake_id  = COALESCE(b.intake_id,  cp.barlist_id),
    project_id = COALESCE(b.project_id, cp.project_id)
FROM public.cut_batches cb
JOIN public.cut_plans cp ON cp.id = cb.source_plan_id
WHERE b.source_cut_batch_id = cb.id
  AND (b.intake_id IS NULL OR b.project_id IS NULL);

-- bundles fallback <- via source_bend_batch_id -> bend_batches.cut_plan_id (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bend_batches' AND column_name='cut_plan_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.bundles b
      SET intake_id  = COALESCE(b.intake_id,  cp.barlist_id),
          project_id = COALESCE(b.project_id, cp.project_id)
      FROM public.bend_batches bb
      JOIN public.cut_plans cp ON cp.id = bb.cut_plan_id
      WHERE b.source_bend_batch_id = bb.id
        AND (b.intake_id IS NULL OR b.project_id IS NULL)
    $sql$;
  END IF;
END $$;

-- pickup_orders <- via cut_plan_items.pickup_id (reverse link)
UPDATE public.pickup_orders po
SET intake_id  = COALESCE(po.intake_id,  sub.intake_id),
    project_id = COALESCE(po.project_id, sub.project_id)
FROM (
  SELECT pickup_id,
         (array_agg(intake_id)  FILTER (WHERE intake_id  IS NOT NULL))[1] AS intake_id,
         (array_agg(project_id) FILTER (WHERE project_id IS NOT NULL))[1] AS project_id
  FROM public.cut_plan_items
  WHERE pickup_id IS NOT NULL
  GROUP BY pickup_id
) sub
WHERE po.id = sub.pickup_id
  AND (po.intake_id IS NULL OR po.project_id IS NULL);

-- pickup_order_items <- pickup_orders
UPDATE public.pickup_order_items poi
SET intake_id  = COALESCE(poi.intake_id,  po.intake_id),
    project_id = COALESCE(poi.project_id, po.project_id)
FROM public.pickup_orders po
WHERE poi.pickup_order_id = po.id
  AND (poi.intake_id IS NULL OR poi.project_id IS NULL);

-- =========================================================================
-- 4. Auto-stamp triggers (BEFORE INSERT/UPDATE)
-- =========================================================================

-- cut_plan_items <- cut_plans
CREATE OR REPLACE FUNCTION public.stamp_intake_from_cut_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intake uuid;
  v_project uuid;
BEGIN
  IF NEW.cut_plan_id IS NOT NULL AND (NEW.intake_id IS NULL OR NEW.project_id IS NULL) THEN
    SELECT barlist_id, project_id INTO v_intake, v_project
    FROM public.cut_plans WHERE id = NEW.cut_plan_id;
    NEW.intake_id  := COALESCE(NEW.intake_id,  v_intake);
    NEW.project_id := COALESCE(NEW.project_id, v_project);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_intake_cut_plan_items ON public.cut_plan_items;
CREATE TRIGGER trg_stamp_intake_cut_plan_items
  BEFORE INSERT OR UPDATE OF cut_plan_id, intake_id, project_id ON public.cut_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.stamp_intake_from_cut_plan();

-- clearance_evidence / loading_checklist <- cut_plan_items
CREATE OR REPLACE FUNCTION public.stamp_intake_from_cut_plan_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intake uuid;
  v_project uuid;
BEGIN
  IF NEW.cut_plan_item_id IS NOT NULL AND (NEW.intake_id IS NULL OR NEW.project_id IS NULL) THEN
    SELECT intake_id, project_id INTO v_intake, v_project
    FROM public.cut_plan_items WHERE id = NEW.cut_plan_item_id;
    NEW.intake_id  := COALESCE(NEW.intake_id,  v_intake);
    NEW.project_id := COALESCE(NEW.project_id, v_project);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_intake_clearance_evidence ON public.clearance_evidence;
CREATE TRIGGER trg_stamp_intake_clearance_evidence
  BEFORE INSERT OR UPDATE OF cut_plan_item_id, intake_id, project_id ON public.clearance_evidence
  FOR EACH ROW EXECUTE FUNCTION public.stamp_intake_from_cut_plan_item();

DROP TRIGGER IF EXISTS trg_stamp_intake_loading_checklist ON public.loading_checklist;
CREATE TRIGGER trg_stamp_intake_loading_checklist
  BEFORE INSERT OR UPDATE OF cut_plan_item_id, intake_id, project_id ON public.loading_checklist
  FOR EACH ROW EXECUTE FUNCTION public.stamp_intake_from_cut_plan_item();

-- packing_slips / deliveries <- cut_plans (via cut_plan_id)
CREATE OR REPLACE FUNCTION public.stamp_intake_from_cut_plan_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intake uuid;
  v_project uuid;
BEGIN
  IF NEW.cut_plan_id IS NOT NULL AND (NEW.intake_id IS NULL OR NEW.project_id IS NULL) THEN
    SELECT barlist_id, project_id INTO v_intake, v_project
    FROM public.cut_plans WHERE id = NEW.cut_plan_id;
    NEW.intake_id  := COALESCE(NEW.intake_id,  v_intake);
    NEW.project_id := COALESCE(NEW.project_id, v_project);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_intake_packing_slips ON public.packing_slips;
CREATE TRIGGER trg_stamp_intake_packing_slips
  BEFORE INSERT OR UPDATE OF cut_plan_id, intake_id, project_id ON public.packing_slips
  FOR EACH ROW EXECUTE FUNCTION public.stamp_intake_from_cut_plan_ref();

DROP TRIGGER IF EXISTS trg_stamp_intake_deliveries ON public.deliveries;
CREATE TRIGGER trg_stamp_intake_deliveries
  BEFORE INSERT OR UPDATE OF cut_plan_id, intake_id, project_id ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.stamp_intake_from_cut_plan_ref();

-- delivery_stops / delivery_bundles <- deliveries
CREATE OR REPLACE FUNCTION public.stamp_intake_from_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intake uuid;
  v_project uuid;
BEGIN
  IF NEW.delivery_id IS NOT NULL AND (NEW.intake_id IS NULL OR NEW.project_id IS NULL) THEN
    SELECT intake_id, project_id INTO v_intake, v_project
    FROM public.deliveries WHERE id = NEW.delivery_id;
    NEW.intake_id  := COALESCE(NEW.intake_id,  v_intake);
    NEW.project_id := COALESCE(NEW.project_id, v_project);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_intake_delivery_stops ON public.delivery_stops;
CREATE TRIGGER trg_stamp_intake_delivery_stops
  BEFORE INSERT OR UPDATE OF delivery_id, intake_id, project_id ON public.delivery_stops
  FOR EACH ROW EXECUTE FUNCTION public.stamp_intake_from_delivery();

DROP TRIGGER IF EXISTS trg_stamp_intake_delivery_bundles ON public.delivery_bundles;
CREATE TRIGGER trg_stamp_intake_delivery_bundles
  BEFORE INSERT OR UPDATE OF delivery_id, intake_id, project_id ON public.delivery_bundles
  FOR EACH ROW EXECUTE FUNCTION public.stamp_intake_from_delivery();

-- pickup_order_items <- pickup_orders
CREATE OR REPLACE FUNCTION public.stamp_intake_from_pickup_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intake uuid;
  v_project uuid;
BEGIN
  IF NEW.pickup_order_id IS NOT NULL AND (NEW.intake_id IS NULL OR NEW.project_id IS NULL) THEN
    SELECT intake_id, project_id INTO v_intake, v_project
    FROM public.pickup_orders WHERE id = NEW.pickup_order_id;
    NEW.intake_id  := COALESCE(NEW.intake_id,  v_intake);
    NEW.project_id := COALESCE(NEW.project_id, v_project);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_intake_pickup_order_items ON public.pickup_order_items;
CREATE TRIGGER trg_stamp_intake_pickup_order_items
  BEFORE INSERT OR UPDATE OF pickup_order_id, intake_id, project_id ON public.pickup_order_items
  FOR EACH ROW EXECUTE FUNCTION public.stamp_intake_from_pickup_order();

-- bundles <- via source_cut_batch_id -> cut_batches.source_plan_id -> cut_plans
CREATE OR REPLACE FUNCTION public.stamp_intake_for_bundle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intake uuid;
  v_project uuid;
BEGIN
  IF (NEW.intake_id IS NOT NULL AND NEW.project_id IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  IF NEW.source_cut_batch_id IS NOT NULL THEN
    SELECT cp.barlist_id, cp.project_id INTO v_intake, v_project
    FROM public.cut_batches cb
    JOIN public.cut_plans cp ON cp.id = cb.source_plan_id
    WHERE cb.id = NEW.source_cut_batch_id;
    NEW.intake_id  := COALESCE(NEW.intake_id,  v_intake);
    NEW.project_id := COALESCE(NEW.project_id, v_project);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_intake_bundles ON public.bundles;
CREATE TRIGGER trg_stamp_intake_bundles
  BEFORE INSERT OR UPDATE OF source_cut_batch_id, source_bend_batch_id, intake_id, project_id ON public.bundles
  FOR EACH ROW EXECUTE FUNCTION public.stamp_intake_for_bundle();
