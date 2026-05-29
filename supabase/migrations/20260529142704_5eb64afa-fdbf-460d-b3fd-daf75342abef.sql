
-- #1: Unified workflow release-state view.
-- Read-only derivation layer. Does NOT change cut_plans.status, cut_plan_items.phase,
-- bundles.status, or clearance_evidence.status. UI reads consistent labels from here
-- so manifest cards (Pickup) and item rows (Clearance) cannot drift apart.

DROP VIEW IF EXISTS public.v_workflow_release_state CASCADE;

CREATE VIEW public.v_workflow_release_state
WITH (security_invoker = true)
AS
WITH item_base AS (
  SELECT
    cpi.id                       AS item_id,
    cpi.cut_plan_id              AS manifest_id,
    cp.company_id                AS company_id,
    cpi.phase                    AS item_phase,
    cp.status                    AS manifest_status_raw,
    ce.status                    AS evidence_status_raw,
    ce.evidence_valid            AS evidence_valid,
    (ce.tag_scan_url IS NOT NULL
     AND ce.material_photo_url IS NOT NULL) AS evidence_complete,
    cpi.delivery_id              AS delivery_id,
    cpi.pickup_id                AS pickup_id,
    cpi.loading_list_id          AS loading_list_id,
    cpi.fulfillment_channel      AS fulfillment_channel
  FROM public.cut_plan_items cpi
  JOIN public.cut_plans cp ON cp.id = cpi.cut_plan_id
  LEFT JOIN public.clearance_evidence ce ON ce.cut_plan_item_id = cpi.id
),
item_labelled AS (
  SELECT
    ib.*,
    CASE
      WHEN ib.item_phase = 'complete'                                    THEN 'released'
      WHEN ib.item_phase = 'clearance' AND ib.evidence_status_raw = 'cleared'
                                                                          THEN 'cleared'
      WHEN ib.item_phase = 'clearance' AND ib.evidence_complete
                                                                          THEN 'evidence_pending_review'
      WHEN ib.item_phase = 'clearance'                                   THEN 'awaiting_evidence'
      WHEN ib.item_phase = 'cut_done'                                    THEN 'cut_complete'
      WHEN ib.item_phase = 'queued'                                      THEN 'queued'
      ELSE COALESCE(ib.item_phase, 'unknown')
    END AS item_sub_state
  FROM item_base ib
),
manifest_rollup AS (
  SELECT
    manifest_id,
    bool_or(item_sub_state = 'awaiting_evidence')        AS has_awaiting,
    bool_or(item_sub_state = 'evidence_pending_review')  AS has_pending_review,
    bool_or(item_sub_state IN ('queued','cut_complete')) AS has_upstream,
    bool_and(item_sub_state = 'released')                AS all_released,
    count(*)                                             AS total_items,
    count(*) FILTER (WHERE item_sub_state = 'released')  AS released_items
  FROM item_labelled
  GROUP BY manifest_id
)
SELECT
  il.item_id,
  il.manifest_id,
  il.company_id,
  il.item_phase,
  il.item_sub_state,
  il.evidence_status_raw,
  il.evidence_complete,
  il.fulfillment_channel,
  il.delivery_id,
  il.pickup_id,
  il.loading_list_id,
  -- Manifest-level derived label (consistent across Pickup + Clearance)
  CASE
    WHEN mr.all_released                                  THEN 'released'
    WHEN mr.has_pending_review                            THEN 'evidence_review'
    WHEN mr.has_awaiting                                  THEN 'in_clearance'
    WHEN mr.has_upstream                                  THEN 'in_production'
    WHEN il.manifest_status_raw = 'draft'                 THEN 'draft'
    WHEN il.manifest_status_raw = 'queued'                THEN 'queued'
    WHEN il.manifest_status_raw = 'ready_for_clearance'   THEN 'awaiting_clearance'
    WHEN il.manifest_status_raw = 'in_production'         THEN 'in_production'
    WHEN il.manifest_status_raw = 'completed'             THEN 'released'
    ELSE COALESCE(il.manifest_status_raw, 'unknown')
  END AS manifest_release_state,
  il.manifest_status_raw,
  mr.total_items,
  mr.released_items,
  -- Bundle-level state is per-item proxy until bundles get a richer lifecycle.
  -- Currently bundles.status is single-valued ('created'); we surface the same
  -- label vocabulary so the UI can switch sources later without churn.
  CASE
    WHEN il.item_sub_state = 'released' THEN 'released'
    WHEN il.item_sub_state IN ('cleared','evidence_pending_review','awaiting_evidence') THEN 'in_clearance'
    ELSE 'in_production'
  END AS bundle_release_state
FROM item_labelled il
JOIN manifest_rollup mr ON mr.manifest_id = il.manifest_id;

GRANT SELECT ON public.v_workflow_release_state TO authenticated;
GRANT SELECT ON public.v_workflow_release_state TO service_role;

COMMENT ON VIEW public.v_workflow_release_state IS
'Unified release-state labels for manifest/bundle/item. security_invoker=true so it inherits RLS from cut_plans + cut_plan_items + clearance_evidence. Read-only; does not alter underlying state machine.';
