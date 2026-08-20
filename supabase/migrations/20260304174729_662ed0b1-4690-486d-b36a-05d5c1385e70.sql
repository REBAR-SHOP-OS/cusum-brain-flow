
-- Drop all dependent views first
DROP VIEW IF EXISTS public.v_orders_enriched CASCADE;
DROP VIEW IF EXISTS public.v_leads_enriched CASCADE;
DROP VIEW IF EXISTS public.v_communications_enriched CASCADE;
DROP VIEW IF EXISTS public.v_customer_company_map CASCADE;
DROP VIEW IF EXISTS public.v_customers_clean CASCADE;

-- Recreate v_customers_clean with correct columns matching customers table
CREATE VIEW public.v_customers_clean AS
SELECT
  c.id AS customer_id,
  c.id,
  c.name,
  c.name AS display_name,
  c.company_name,
  c.normalized_name,
  c.phone,
  c.email,
  c.status,
  c.company_id,
  c.created_at,
  c.updated_at,
  c.quickbooks_id,
  c.customer_type,
  c.payment_terms,
  c.credit_limit,
  c.notes,
  c.merged_into_customer_id,
  c.merged_at,
  c.merged_by,
  c.merge_reason
FROM public.customers c
WHERE c.status NOT IN ('archived', 'archived_odoo_only')
  AND c.merged_into_customer_id IS NULL
  AND position(', ' in c.name) = 0;

-- Recreate v_customer_company_map
CREATE VIEW public.v_customer_company_map AS
SELECT
  c.id AS legacy_customer_id,
  CASE
    WHEN position(', ' in c.name) > 0 THEN
      COALESCE(
        (SELECT c2.id FROM public.customers c2
         WHERE c2.normalized_name = c.normalized_name
           AND position(', ' in c2.name) = 0
           AND c2.status NOT IN ('archived', 'archived_odoo_only')
           AND c2.merged_into_customer_id IS NULL
         LIMIT 1),
        c.id
      )
    ELSE c.id
  END AS company_customer_id,
  c.company_id
FROM public.customers c
WHERE c.status NOT IN ('archived', 'archived_odoo_only')
  AND c.merged_into_customer_id IS NULL;

-- Recreate v_orders_enriched
CREATE VIEW public.v_orders_enriched AS
SELECT o.id, o.order_number, o.quote_id, o.customer_id, o.status, o.order_date,
  o.required_date, o.total_amount, o.quickbooks_invoice_id, o.notes, o.created_at,
  o.updated_at, o.company_id, o.shop_drawing_status, o.customer_revision_count,
  o.billable_revision_required, o.qc_internal_approved_at, o.customer_approved_at,
  o.production_locked, o.pending_change_order, o.qc_final_approved, o.qc_evidence_uploaded,
  o.lead_id, o.order_kind, o.owner_id, o.priority, o.delivery_method, o.expected_value,
  o.production_override, o.due_date,
  m.company_customer_id,
  cc.name AS resolved_company_name
FROM orders o
LEFT JOIN v_customer_company_map m ON m.legacy_customer_id = o.customer_id
LEFT JOIN customers cc ON cc.id = m.company_customer_id;

-- Recreate v_leads_enriched
CREATE VIEW public.v_leads_enriched AS
SELECT l.id, l.customer_id, l.contact_id, l.quote_id, l.title, l.description,
  l.stage, l.probability, l.expected_value, l.expected_close_date, l.source,
  l.assigned_to, l.priority, l.notes, l.created_at, l.updated_at, l.company_id,
  l.source_email_id, l.metadata, l.sla_deadline, l.sla_breached, l.escalated_to,
  l.computed_score, l.score_updated_at, l.win_prob_score, l.priority_score, l.score_confidence,
  cust.name AS customer_name,
  COALESCE(NULLIF(cust.company_name, ''), cust.name) AS customer_company_name
FROM leads l
LEFT JOIN customers cust ON cust.id = l.customer_id;

-- Recreate v_communications_enriched
CREATE VIEW public.v_communications_enriched AS
SELECT comm.id, comm.source, comm.source_id, comm.direction, comm.from_address,
  comm.to_address, comm.subject, comm.body_preview, comm.customer_id, comm.contact_id,
  comm.status, comm.thread_id, comm.metadata, comm.received_at, comm.created_at,
  comm.user_id, comm.company_id, comm.ai_category, comm.ai_urgency,
  comm.ai_action_required, comm.ai_action_summary, comm.ai_draft, comm.ai_processed_at,
  comm.ai_priority_data, comm.resolved_at, comm.resolved_summary, comm.lead_id,
  cust.name AS customer_name,
  COALESCE(NULLIF(cust.company_name, ''), cust.name) AS customer_company_name,
  cont.first_name AS contact_first_name,
  cont.last_name AS contact_last_name,
  cont.email AS contact_email
FROM communications comm
LEFT JOIN customers cust ON cust.id = comm.customer_id
LEFT JOIN contacts cont ON cont.id = comm.contact_id;
