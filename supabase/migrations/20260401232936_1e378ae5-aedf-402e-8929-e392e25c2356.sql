
-- Must drop and recreate v_leads_enriched due to column reorder
DROP VIEW IF EXISTS public.v_leads_enriched CASCADE;

CREATE VIEW public.v_leads_enriched AS
SELECT l.id,
  l.customer_id,
  l.contact_id,
  l.quote_id,
  l.title,
  l.description,
  l.stage,
  l.normalized_stage,
  l.lifecycle_type,
  l.assigned_estimator,
  l.disqualification_reason,
  l.probability,
  l.expected_value,
  l.expected_close_date,
  l.source,
  l.assigned_to,
  l.priority,
  l.notes,
  l.created_at,
  l.updated_at,
  l.company_id,
  l.source_email_id,
  l.metadata,
  l.sla_deadline,
  l.sla_breached,
  l.escalated_to,
  l.computed_score,
  l.score_updated_at,
  l.win_prob_score,
  l.priority_score,
  l.score_confidence,
  cust.name AS customer_name,
  COALESCE(NULLIF(cust.company_name, ''::text), cust.name) AS customer_company_name
FROM leads l
LEFT JOIN customers cust ON cust.id = l.customer_id;

ALTER VIEW public.v_leads_enriched SET (security_invoker = on);

-- Active work orders (excludes shells)
CREATE OR REPLACE VIEW public.v_active_work_orders AS
SELECT wo.*
FROM work_orders wo
WHERE wo.is_shell = false;

ALTER VIEW public.v_active_work_orders SET (security_invoker = on);

-- Pricing bottleneck visibility
CREATE OR REPLACE VIEW public.v_pricing_bottleneck AS
SELECT
  o.id,
  o.order_number,
  o.customer_id,
  c.name AS customer_name,
  o.status,
  o.total_amount,
  o.due_date,
  o.order_kind,
  o.created_at,
  o.company_id,
  CASE
    WHEN o.created_at > now() - interval '7 days' THEN '0-7d'
    WHEN o.created_at > now() - interval '30 days' THEN '8-30d'
    WHEN o.created_at > now() - interval '90 days' THEN '31-90d'
    ELSE '90d+'
  END AS age_bucket,
  extract(day FROM now() - o.created_at)::integer AS days_waiting
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'needs_pricing'
  AND (o.total_amount IS NULL OR o.total_amount = 0);

ALTER VIEW public.v_pricing_bottleneck SET (security_invoker = on);
