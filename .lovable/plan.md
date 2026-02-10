

# Odoo-to-Pipeline Migration Plan

## Current State (What I Found)

| Metric | Count |
|--------|-------|
| Total leads in pipeline | 44 (17 new, 17 won, 10 lost) |
| Stages in use | Only 3 of 16 defined stages |
| OdooBot emails in communications | 19 (assignments + stage moves) |
| Total rebar.shop emails | 350 |
| External inbound emails (non-Odoo, non-internal) | 51 |

**Key Observation:** OdooBot sends structured notification emails like:
- `"Lucan Biddulph WWTP Follow up: Chk new lead moved to CRM stages" assigned to you`
- `You have been assigned to amigun Aanuoluwapo`
- `Lead Acquisition` (leaderboard/performance reports)

These contain the **lead name**, **Odoo stage**, **assignee**, and **deadline** -- enough to reconstruct the Odoo pipeline.

## The Problem

Right now the RFQ scanner **skips OdooBot emails** (line 23: `SKIP_INTERNAL_BOTS = ["odoobot"]`). This means Odoo CRM activity is invisible to the pipeline. Meanwhile, you're running both systems in parallel, which creates data gaps and duplicates.

## Migration Strategy: "Shadow Sync" (Zero Damage)

Rather than a risky one-time migration, we build a **continuous OdooBot email parser** that reads Odoo notification emails and mirrors them into your pipeline. This way:

- Old/continuing projects from Odoo appear automatically
- No data loss -- Odoo stays untouched
- You can gradually transition at your own pace
- Duplicate detection prevents double-entries

### Phase 1: OdooBot Email Parser (New Edge Function)

Create `sync-odoo-leads` edge function that:

1. **Scans all 4 mailboxes** (vicky, ai, neel, ben) for OdooBot emails
2. **Parses structured data** from the email subjects and bodies:
   - Lead name: extracted from `Document: "Lead Name"` pattern
   - Odoo stage: extracted from `"moved to CRM stages"` context
   - Assignee: extracted from `"assigned to you"` + recipient address
   - Deadline: extracted from `Deadline:` line
3. **Maps Odoo stages to your pipeline stages** using a lookup table:
   - Odoo "New" -> your "new"
   - Odoo "Qualified" -> your "qualified" 
   - Odoo "Quotation" -> your "quotation_bids"
   - etc.
4. **Deduplicates** using `source_email_id` (same pattern as RFQ scanner)
5. **Links to existing customers** using fuzzy matching (reuses existing logic)
6. **Marks source as "odoo_sync"** so you can filter/identify migrated leads

### Phase 2: Multi-Mailbox Gmail Scan

Expand the RFQ scanner to also scan **all 4 mailboxes** instead of just the logged-in user's inbox. This captures CRM emails, customer replies, and RFQs arriving at any team member's address.

1. Query `user_gmail_tokens` for vicky, ai, neel, ben email addresses
2. Fetch emails from each mailbox via Gmail API
3. Merge and deduplicate across mailboxes
4. Feed into the existing AI analysis pipeline

### Phase 3: Pipeline UI Enhancement

Add an "Odoo" source badge and filter to the pipeline board so you can see which leads came from Odoo vs. direct email vs. manual entry.

## Technical Details

### New Edge Function: `sync-odoo-leads`

```text
Input: POST { force?: boolean }
Process:
  1. Query communications WHERE from_address ILIKE '%odoo%'
  2. Parse each email subject for lead name + stage
  3. Check if lead already exists (by name fuzzy match OR source_email_id)
  4. If new: create lead with correct stage mapping
  5. If exists: update stage if Odoo shows a different stage
Output: { synced: number, updated: number, skipped: number }
```

### Odoo Stage Mapping Table

```text
Odoo Stage               ->  Pipeline Stage
-------------------------------------------
New                       ->  new
Telephonic Enquiries      ->  telephonic_enquiries
Qualified                 ->  qualified
RFI                       ->  rfi
Proposal                  ->  proposal
QC - Ben                  ->  qc_ben
Estimation - Ben          ->  estimation_ben
Estimation - Karthick     ->  estimation_karthick
Hot Enquiries             ->  hot_enquiries
Quotation Priority        ->  quotation_priority
Quotation Bids            ->  quotation_bids
Won                       ->  won
Lost                      ->  lost
Shop Drawing              ->  shop_drawing
Shop Drawing Approval     ->  shop_drawing_approval
```

### Modified Files

| File | Change |
|------|--------|
| `supabase/functions/sync-odoo-leads/index.ts` | **New** -- OdooBot email parser + lead sync |
| `supabase/functions/process-rfq-emails/index.ts` | Add multi-mailbox scanning across all 4 team inboxes |
| `src/pages/Pipeline.tsx` | Add "Sync Odoo" button next to "Scan RFQ" |
| `src/components/pipeline/LeadCard.tsx` | Show source badge (Odoo / Email / Manual) |

### Safety Measures

- All synced leads get `source: "odoo_sync"` and `source_email_id: "odoo_{comm_id}"` for traceability
- Existing leads are never overwritten -- only stage updates if the Odoo stage is newer
- A dry-run mode can be added to preview what would be synced before committing
- The original OdooBot emails remain in communications table as audit trail

