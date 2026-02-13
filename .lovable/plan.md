
# Shop Drawing QC, Revision Control, and Escalation System

This plan implements your full end-to-end quality control workflow, revision billing enforcement, SLA escalation, and boss dashboards -- all layered on top of the existing schema with minimal structural changes (flags + triggers only, no table redesigns).

---

## Phase 1: Database Schema Additions (Migration)

### A) Orders table -- new safety lock columns
- `shop_drawing_status` TEXT DEFAULT 'draft' (draft, qc_internal, sent_to_customer, customer_revision, approved)
- `customer_revision_count` INT DEFAULT 0
- `billable_revision_required` BOOLEAN DEFAULT FALSE
- `qc_internal_approved_at` TIMESTAMPTZ NULL
- `customer_approved_at` TIMESTAMPTZ NULL
- `production_locked` BOOLEAN DEFAULT TRUE
- `pending_change_order` BOOLEAN DEFAULT FALSE
- `qc_final_approved` BOOLEAN DEFAULT FALSE
- `qc_evidence_uploaded` BOOLEAN DEFAULT FALSE

### B) Leads table -- SLA tracking columns
- `sla_deadline` TIMESTAMPTZ NULL (auto-set by trigger on stage change)
- `sla_breached` BOOLEAN DEFAULT FALSE
- `escalated_to` TEXT NULL

### C) New table: `sla_escalation_log`
Audit trail of every SLA breach and escalation event.
- `id`, `entity_type` (lead/order), `entity_id`, `stage`, `sla_hours`, `breached_at`, `escalated_to`, `resolved_at`, `company_id`

### D) Validation triggers

1. **`trg_block_production_without_approval`** on `cut_plan_items` BEFORE UPDATE: If `phase` is moving to 'cutting', join to parent order and block if `shop_drawing_status != 'approved'` OR `pending_change_order = TRUE` OR `qc_internal_approved_at IS NULL`.

2. **`trg_auto_billable_revision`** on `orders` BEFORE UPDATE: If `customer_revision_count` changes to >= 1 AND `billable_revision_required` is FALSE, auto-set `billable_revision_required = TRUE` and `pending_change_order = TRUE`.

3. **`trg_block_delivery_without_qc`** on `deliveries` BEFORE UPDATE: If status is moving to 'loading' or 'in_transit', join to related order and block if `qc_evidence_uploaded = FALSE` OR `qc_final_approved = FALSE`.

4. **`trg_set_sla_deadline`** on `leads` BEFORE UPDATE: When `stage` changes, auto-compute `sla_deadline` based on the SLA matrix (e.g., new -> 24h, estimation -> 48h, shop_drawing -> 72h, customer approval -> 5 days).

---

## Phase 2: SLA Escalation Engine (Edge Function)

New edge function: `check-sla-breaches`

- Runs on cron (every 15 minutes)
- Queries `leads` WHERE `sla_deadline < NOW()` AND `sla_breached = FALSE`
- Queries `orders` WHERE `production_locked = TRUE` AND age > 12h, or `qc_evidence_uploaded = FALSE` AND age > 4h
- For each breach: sets `sla_breached = TRUE`, logs to `sla_escalation_log`, creates a `human_task` for the appropriate escalation target
- Escalation targets follow the matrix:
  - Intake/Customer Approval/Revisions > 1 -> Sales Mgr
  - Estimation QC/Shop Drawing/Production Blocked/QC Evidence/Delivery -> Ops Mgr

---

## Phase 3: generate-suggestions Engine Updates

Expand the existing `generate-suggestions` edge function with new rules:

### Vizzy (CEO) -- new rules
- Jobs blocked by revision / change order
- QC failure rate (orders with `qc_final_approved = FALSE` past deadline)
- Revenue waiting on QC/Delivery (orders with `qc_evidence_uploaded = FALSE`)
- Repeat revision offenders (customers with > 2 revisions across orders)

### Penny (Accounting) -- new rule
- Paid revision opportunities (orders with `billable_revision_required = TRUE` and no change order invoiced)

### Forge (Shop Floor) -- new rule
- Production blocked reasons (orders with `production_locked = TRUE` -- detail why: missing shop drawing, pending CO, missing QC)

---

## Phase 4: Boss Dashboard Views

### A) CEO Portal additions (CEODashboardView)
New KPI cards and sections:
- **Blocked Jobs** count (orders with `production_locked = TRUE`)
- **QC Backlog** (orders awaiting `qc_final_approved`)
- **Revenue Held** (sum of `total_amount` where `qc_evidence_uploaded = FALSE`)
- **Revision Offenders** mini-table (customers ranked by total revision count)
- **SLA Breach Summary** card with counts by category

### B) New SLA Tracker component
`src/components/ceo/SLATrackerCard.tsx`
- Compact table showing active SLA timers per stage
- Color-coded: green (on track), amber (< 2h remaining), red (breached)
- Click-through to the lead/order

### C) Pipeline stage enhancements
Add visual indicators on pipeline board:
- Shop drawing status badge on lead cards when in `shop_drawing` or `shop_drawing_approval` stage
- SLA countdown timer badge
- Revision count badge

---

## Phase 5: Order Detail Workflow UI

### Order detail panel additions
- **Shop Drawing Status** stepper (draft -> QC Internal -> Sent to Customer -> Customer Revision -> Approved)
- **Revision Counter** with visual warning at 1+ (shows "Billable" badge)
- **QC Checklist** section:
  - QC Internal Approval (checkbox, stamps timestamp)
  - Customer Approval (checkbox, stamps timestamp)
  - QC Evidence Uploaded (checkbox)
  - QC Final Approved (checkbox)
- **Production Lock** indicator (red lock icon when locked, green unlock when all gates pass)
- **Change Order** banner when `pending_change_order = TRUE`

---

## Phase 6: Quote Terms Auto-Include

Update `AccountingDocuments.tsx` default terms to include:
```
"One (1) shop drawing revision included. Additional revisions billable via Change Order."
"Revisions impacting quantities, bar sizes, coatings, or scope are re-priced regardless of count."
```

---

## Technical Details

### Files to Create
1. `supabase/migrations/XXXXX_shop_drawing_qc_system.sql` -- all schema changes, triggers
2. `supabase/functions/check-sla-breaches/index.ts` -- SLA cron engine
3. `src/components/ceo/SLATrackerCard.tsx` -- SLA dashboard widget
4. `src/components/orders/ShopDrawingStepper.tsx` -- visual stepper component
5. `src/components/orders/QCChecklist.tsx` -- QC gate checklist
6. `src/components/orders/ProductionLockBanner.tsx` -- lock status banner

### Files to Modify
7. `supabase/functions/generate-suggestions/index.ts` -- add new Vizzy/Penny/Forge rules
8. `src/hooks/useCEODashboard.ts` -- add blocked jobs, QC backlog, SLA breach metrics
9. `src/components/office/CEODashboardView.tsx` -- render new KPI cards and SLA tracker
10. `src/pages/CEOPortal.tsx` -- add SLA tracker card
11. `src/components/accounting/AccountingDocuments.tsx` -- update default quote terms
12. `src/pages/Pipeline.tsx` -- add SLA/revision badges to pipeline cards
13. `supabase/config.toml` -- register new edge function

### SLA Matrix (encoded in trigger + edge function)

```text
Stage                    SLA      Escalation Target
-----------------------------------------------------
Intake (new)             24h      Sales Mgr
Estimation               48h      Sales Mgr
QC on Estimate           24h      Ops Mgr
Shop Drawing Draft       72h      Ops Mgr
QC on Shop Drawing       24h      Ops Mgr
Customer Approval        5 days   Sales Mgr
Production Blocked       12h      Ops Mgr
QC Evidence Pending      4h       Ops Mgr
Delivery Pending         24h      Ops Mgr
Revisions > 1            Immediate Sales + Ops
```

### Cron Setup
- `check-sla-breaches` runs every 15 minutes via `pg_cron`
- Uses same `x-cron-secret` pattern as existing `qb-incremental-sync`
