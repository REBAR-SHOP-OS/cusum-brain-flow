

# End-to-End Odoo Parity, UX Refinements, and Marketing/Prospecting Hardening

## What Already Exists (No Rebuild Needed)

The system already has substantial coverage for most phases requested:

- **Odoo CRM Sync**: `odoo-crm-sync` edge function syncs last 5 days, maps stages, normalizes probability (won=100, lost=0), deduplicates by `odoo_id`, creates customers from `partner_name`
- **RFQ Email Routing**: `process-rfq-emails` implements multi-signal scoring (thread_id 0.95, In-Reply-To 0.90, RFQ ref 0.50, subject similarity 0.30), strict "New" gate with Neel escalation for uncertain matches (0.4-0.79)
- **Email Marketing Manager**: Full AI-driven campaign system with `email_campaigns`, `email_campaign_sends`, `email_suppressions`, `email_consent_events` tables, approval workflow, suppression gates, unsubscribe flow
- **Prospecting**: AI prospect generation at `/prospecting` with Ontario targeting, auto-follow-up scheduling
- **Odoo-Style UI**: 46px `bg-primary` header, Kanban pipeline, avatar dropdown via Radix DropdownMenu (already handles toggle/ESC/outside-click per memory)
- **Pipeline Smart Search**: Natural language parsing with stage, revenue, stale filters

## What Needs Building (The Gaps)

### Phase 1: Odoo Sync Hardening (P0)

**1a. Reconciliation Comparison Report**

Add a `/admin` panel that runs the sync and outputs the comparison table:

| Odoo_id | ERP_id | Status | Diffs | Action |
|---------|--------|--------|-------|--------|

- New edge function `odoo-reconciliation-report` that:
  - Fetches Odoo leads (last 5 days) and ERP leads
  - Classifies each as MATCH, MISSING_IN_ERP, OUT_OF_SYNC, DUPLICATE
  - Returns structured JSON with diffs (stage, probability, value, contact linkage)
  - Stores results in a `reconciliation_runs` table for audit
- New admin UI component `OdooReconciliationReport.tsx` showing the table with action buttons

**1b. Contact Linkage Enforcement**

The current sync creates customers but some older leads may have null `customer_id`. Add:

- A migration check: flag active leads (stage not lost/won) with null `customer_id`
- Enhance `odoo-crm-sync` to always resolve `partner_name` to a customer and never leave `customer_id` null for active stages
- Add validation: if `customer_id` is null and stage is active, block the upsert and log an error

**1c. Activity/Timeline Parity**

Currently, `odoo-crm-sync` syncs field values but not stage change history. Add:

- New table `lead_events` (append-only): `id, lead_id, event_type, payload, source_system, created_at`
- Event types: `stage_changed`, `value_changed`, `contact_linked`, `note_added`
- Enhance `odoo-crm-sync` to detect stage changes (compare current ERP stage vs incoming Odoo stage) and insert `lead_events` entries
- Display timeline events in `LeadTimeline.tsx` (already exists, would need to pull from new table)

### Phase 2: Email Deliverability Hardening (P0)

**2a. RFC 8058 List-Unsubscribe Headers**

The `email-campaign-send` function currently sends via `gmail-send` but does not inject List-Unsubscribe headers. Add:

- Pass `List-Unsubscribe` and `List-Unsubscribe-Post` headers to `gmail-send`
- Format: `List-Unsubscribe: <mailto:unsubscribe@rebar.shop>, <https://...unsubscribe?token=...>`
- Format: `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- Update `gmail-send` to accept and pass custom headers

**2b. Unsubscribe SLA Monitoring**

- Add `processed_at` column to `email_suppressions` to track when unsubscribe was actioned
- Dashboard widget showing unsubscribe processing time (target: under 48 hours)
- Automated alert if any unsubscribe pending longer than 24 hours

### Phase 3: Reconciliation Admin Panel (P1)

**3a. Full Reconciliation Dashboard**

New admin section with:

- Mapping fix table (Odoo field to ERP field with transform rules)
- Duplicate merge/delete log with rollback map
- Stage mapping/probability table (editable)
- Event parity report (missing timeline items)

**3b. Safe Dedupe with Rollback**

The current `odoo-crm-sync` already deduplicates by `odoo_id` and deletes victims. Harden:

- New table `dedup_rollback_log`: `id, deleted_id, survivor_id, pre_merge_snapshot, post_merge_snapshot, created_at`
- Before deleting duplicate leads, snapshot their full record into the rollback log
- Admin UI to view rollback history and restore if needed

### Phase 4: UX Parity Refinements (P1)

**4a. Global Dropdown Controller**

The current `UserMenu` uses Radix `DropdownMenu` which already implements:
- Click to open, click trigger again to close
- Outside click to close
- ESC to close
- Only one Radix dropdown open at a time (Radix handles this natively)

The memory confirms this is the established pattern. No custom `GlobalDropdownController` is needed because Radix already enforces these behaviors. Verify and document that all dropdown instances use Radix consistently.

**4b. Sidebar/Drawer Grouping Alignment**

Current sidebar is icon-only (w-16). To match Odoo's drawer grouping:
- Group nav items with subtle separators matching Odoo categories (CRM, Operations, Admin)
- Add tooltip labels matching Odoo terminology
- Pipeline always opens to Kanban (already the case)

### Phase 5: Prospect Digger Enhancements (P2)

**5a. Multi-Source Ingestion**

The current `prospect-leads` generates AI prospects. Extend to ingest from:
- Website contact forms (already handled by `process-rfq-emails`)
- CRM/ERP existing customers for upsell targeting
- Ad lead imports (CSV upload for LinkedIn Lead Gen Forms data)

**5b. LinkedIn Compliance Guard**

- Add explicit UI warning: "AI drafts messages for you to copy and send manually"
- No automated LinkedIn actions
- Draft connection notes/InMails that humans copy-paste

### Phase 6: Neel Approval Hardening (P2)

**6a. Approval-Required Gate for All Outbound**

Currently the email marketing system requires `approved_by` before sending. Extend:
- Add Neel-specific approval requirement (configurable approver email)
- Approval notification via existing email/notification system
- Approval packet includes: recipient count, sample preview, compliance checklist status, suppression counts

## Technical Details

### New Database Tables

**lead_events** (append-only activity ledger)
```
id uuid PK, lead_id uuid FK leads, event_type text, 
payload jsonb, source_system text, dedupe_key text UNIQUE,
created_at timestamptz
```

**reconciliation_runs** (sync audit)
```
id uuid PK, run_at timestamptz, window_days int,
results jsonb, created_count int, updated_count int,
missing_count int, out_of_sync_count int, duplicate_count int
```

**dedup_rollback_log** (safe delete history)
```
id uuid PK, deleted_id uuid, survivor_id uuid,
pre_merge_snapshot jsonb, post_merge_snapshot jsonb,
created_at timestamptz
```

### Files to Create
- `src/components/admin/OdooReconciliationReport.tsx`
- `supabase/functions/odoo-reconciliation-report/index.ts`

### Files to Modify
- `supabase/functions/odoo-crm-sync/index.ts` -- Add timeline events, contact enforcement, rollback logging
- `supabase/functions/email-campaign-send/index.ts` -- Add RFC 8058 headers
- `supabase/functions/gmail-send/index.ts` -- Accept custom headers parameter
- `src/components/pipeline/LeadTimeline.tsx` -- Display lead_events
- `src/components/layout/Sidebar.tsx` -- Add nav grouping separators
- `src/pages/Admin.tsx` -- Add reconciliation report tab

### Execution Priority

| Priority | Work Item | Effort |
|----------|-----------|--------|
| P0 | RFC 8058 List-Unsubscribe headers in email sends | S |
| P0 | Contact linkage enforcement in odoo-crm-sync | S |
| P0 | Reconciliation comparison report (edge function + admin UI) | M |
| P1 | lead_events table + timeline parity | M |
| P1 | Dedup rollback logging | S |
| P1 | Sidebar nav grouping alignment | S |
| P2 | Multi-source prospect ingestion | M |
| P2 | LinkedIn compliance guard UI | S |
| P2 | Neel-specific approval hardening | S |

### Validation Checks
- After sync: 100% of Odoo records have exactly one ERP mirror with matching odoo_id
- 0 active leads with null customer_id
- "New" stage contains only truly new RFQs (existing behavior via process-rfq-emails)
- All marketing emails include List-Unsubscribe and List-Unsubscribe-Post headers
- Unsubscribes processed within 48 hours
- Zero outbound sends without approval
- No LinkedIn automation in codebase

