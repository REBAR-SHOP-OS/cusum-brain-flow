
-- ============================================================
-- 1. Lead normalization columns
-- ============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS normalized_stage text,
  ADD COLUMN IF NOT EXISTS assigned_estimator text,
  ADD COLUMN IF NOT EXISTS disqualification_reason text,
  ADD COLUMN IF NOT EXISTS lifecycle_type text;

-- ============================================================
-- 3. Work order shell flag columns
-- ============================================================
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS is_shell boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shell_reason text;

-- ============================================================
-- 4. Fix production_tasks.project_id FK
-- ============================================================
ALTER TABLE public.production_tasks
  DROP CONSTRAINT IF EXISTS production_tasks_project_id_fkey;

ALTER TABLE public.production_tasks
  ADD CONSTRAINT production_tasks_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

-- ============================================================
-- 5. Workflow status normalization view
-- ============================================================
CREATE OR REPLACE VIEW public.v_workflow_status_map AS

-- Lead stage mapping
SELECT 'lead' AS entity_type,
  stage AS original_status,
  CASE stage
    WHEN 'new' THEN 'new'
    WHEN 'prospecting' THEN 'prospecting'
    WHEN 'telephonic_enquiries' THEN 'enquiry'
    WHEN 'hot_enquiries' THEN 'enquiry'
    WHEN 'qualified' THEN 'qualified'
    WHEN 'rfi' THEN 'rfi'
    WHEN 'estimation_ben' THEN 'estimation'
    WHEN 'estimation_karthick' THEN 'estimation'
    WHEN 'qc_ben' THEN 'quality_check'
    WHEN 'quotation_bids' THEN 'quotation'
    WHEN 'quotation_priority' THEN 'quotation'
    WHEN 'shop_drawing' THEN 'shop_drawing'
    WHEN 'shop_drawing_approval' THEN 'shop_drawing'
    WHEN 'addendums' THEN 'addendum'
    WHEN 'fabrication_in_shop' THEN 'fabrication'
    WHEN 'ready_to_dispatch' THEN 'dispatch'
    WHEN 'out_for_delivery' THEN 'delivery'
    WHEN 'delivered_pickup_done' THEN 'delivered'
    WHEN 'won' THEN 'won'
    WHEN 'lost' THEN 'lost'
    WHEN 'loss' THEN 'lost'
    WHEN 'no_rebars_out_of_scope' THEN 'disqualified'
    WHEN 'archived_orphan' THEN 'archived'
    WHEN 'dreamers' THEN 'disqualified'
    WHEN 'merged' THEN 'merged'
    ELSE stage
  END AS normalized_status,
  CASE stage
    WHEN 'won' THEN 'closed'
    WHEN 'lost' THEN 'closed'
    WHEN 'loss' THEN 'closed'
    WHEN 'no_rebars_out_of_scope' THEN 'disqualified'
    WHEN 'archived_orphan' THEN 'archived'
    WHEN 'dreamers' THEN 'disqualified'
    WHEN 'merged' THEN 'archived'
    WHEN 'delivered_pickup_done' THEN 'fulfillment'
    WHEN 'out_for_delivery' THEN 'fulfillment'
    WHEN 'fabrication_in_shop' THEN 'fulfillment'
    WHEN 'ready_to_dispatch' THEN 'fulfillment'
    ELSE 'crm'
  END AS lifecycle_type
FROM (SELECT DISTINCT stage FROM public.leads WHERE stage IS NOT NULL) s

UNION ALL

-- Work order status mapping
SELECT 'work_order' AS entity_type,
  status AS original_status,
  CASE status
    WHEN 'pending' THEN 'pending'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'completed' THEN 'completed'
    WHEN 'on_hold' THEN 'on_hold'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE status
  END AS normalized_status,
  CASE status
    WHEN 'completed' THEN 'closed'
    WHEN 'cancelled' THEN 'closed'
    ELSE 'active'
  END AS lifecycle_type
FROM (SELECT DISTINCT status FROM public.work_orders WHERE status IS NOT NULL) s

UNION ALL

-- Delivery status mapping
SELECT 'delivery' AS entity_type,
  status AS original_status,
  CASE status
    WHEN 'pending' THEN 'pending'
    WHEN 'staged' THEN 'staged'
    WHEN 'scheduled' THEN 'scheduled'
    WHEN 'in_transit' THEN 'in_transit'
    WHEN 'delivered' THEN 'delivered'
    ELSE status
  END AS normalized_status,
  CASE status
    WHEN 'delivered' THEN 'closed'
    ELSE 'active'
  END AS lifecycle_type
FROM (SELECT DISTINCT status FROM public.deliveries WHERE status IS NOT NULL) s;
