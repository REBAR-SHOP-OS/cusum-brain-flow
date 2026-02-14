

# AI-Driven Email Marketing Manager -- MVP Build Plan

## Overview

Build an email marketing module inside the Rebar ERP that mirrors the Social Media Manager pattern: AI plans and drafts everything, humans approve before anything sends. The system leverages the existing Gmail send infrastructure, contact database (1,060 unique emails), and Lovable AI gateway.

## Architecture

The design follows the same proven pattern as the Social Media Manager (Pixel): AI generates draft campaigns, they land in a review queue, and only human-approved campaigns execute via the existing `gmail-send` edge function.

```text
Contact DB + Leads + Orders
        |
        v
AI Campaign Planner (edge function)
  - Segments audience
  - Generates subject lines + body variants
  - Proposes schedule
        |
        v
  email_campaigns table (status: draft)
        |
        v
  Human Review UI (approve / edit / decline)
        |
        v
  Campaign Send Engine (edge function)
  - Checks suppression list
  - Checks consent
  - Sends via gmail-send
  - Logs results
        |
        v
  Monitoring + Engagement Tracking
```

## Phase 1: Database Foundation (Migration)

### New Tables

**email_campaigns** -- Core campaign object
- `id` uuid PK
- `title` text
- `campaign_type` text (nurture, follow_up, newsletter, winback, announcement)
- `status` text (draft, pending_approval, approved, sending, sent, paused, canceled)
- `subject_line` text
- `preview_text` text
- `body_html` text
- `body_text` text (plain text fallback)
- `segment_rules` jsonb (audience definition)
- `estimated_recipients` integer
- `scheduled_at` timestamptz
- `sent_at` timestamptz
- `approved_by` uuid (FK profiles)
- `approved_at` timestamptz
- `created_by` uuid (FK profiles)
- `metadata` jsonb (variants, AI generation context, experiment config)
- `company_id` uuid
- `created_at`, `updated_at` timestamptz

**email_campaign_sends** -- Per-recipient send log
- `id` uuid PK
- `campaign_id` uuid FK email_campaigns
- `contact_id` uuid FK contacts
- `email` text
- `status` text (queued, sent, delivered, opened, clicked, bounced, complained, unsubscribed)
- `sent_at` timestamptz
- `opened_at` timestamptz
- `clicked_at` timestamptz
- `error_message` text
- `metadata` jsonb

**email_suppressions** -- Central suppression ledger
- `id` uuid PK
- `email` text UNIQUE
- `reason` text (unsubscribe, bounce, complaint, manual)
- `source` text (campaign_id or "manual")
- `suppressed_at` timestamptz
- `company_id` uuid

**email_consent_events** -- Append-only consent audit trail
- `id` uuid PK
- `contact_id` uuid FK contacts
- `email` text
- `consent_type` text (marketing_email, transactional)
- `status` text (granted, revoked)
- `source` text (web_form, import, manual)
- `evidence` jsonb (IP, form URL, timestamp)
- `recorded_at` timestamptz
- `company_id` uuid

### RLS Policies
- All tables: authenticated users with office/admin/sales roles via `has_any_role()`
- email_suppressions: admin-only for delete; office+ for insert/select
- email_consent_events: insert-only for non-admins (append-only pattern)

### Validation Triggers
- `validate_campaign_status()`: enforce allowed status transitions
- `validate_suppression_reason()`: enforce enum values

## Phase 2: AI Campaign Generator (Edge Function)

### New: `supabase/functions/email-campaign-generate/index.ts`

Actions:
- **plan-campaign**: Given a campaign type + brief, AI returns segment rules, subject line variants, body draft, and schedule recommendation
- **generate-content**: Given segment + goal, generates HTML email body using brand kit + RAG from knowledge base
- **generate-variants**: Creates A/B subject line and body variants for experimentation

Uses `google/gemini-2.5-flash` via Lovable AI gateway (no API key needed). System prompt includes:
- Rebar.Shop brand context (from `brand_kit` table)
- Approved facts only (from `knowledge` table)
- Claims firewall: price/lead-time/certification statements must reference source or flag `[NEEDS HUMAN INPUT]`
- CAN-SPAM compliance footer requirement
- Unsubscribe link placeholder

### New: `supabase/functions/email-campaign-send/index.ts`

Execution engine (only runs for `status = 'approved'` campaigns):
1. Load campaign + segment rules
2. Query contacts matching segment, excluding suppressions
3. For each recipient: call existing `gmail-send` function internally
4. Log each send to `email_campaign_sends`
5. Rate limit: max 50 emails/minute to protect deliverability
6. Update campaign status to `sent` when complete
7. Respects `comms_config.no_act_global` safety switch

Safety gates before any send:
- Campaign must have `approved_by` set
- All recipients checked against `email_suppressions`
- Physical address footer present in body
- Unsubscribe link present
- `List-Unsubscribe` header injected

## Phase 3: Email Marketing Manager Page

### New: `src/pages/EmailMarketing.tsx`

UI layout following the Social Media Manager pattern:

**Header**: Back button, title "Email Marketing", "Generate Campaign" button (sparkle icon), Settings

**Dashboard Cards**:
- Campaigns to review (pending_approval count)
- Sent this month
- Open rate (aggregate)
- Suppression count

**Campaign List** (filterable by status):
- Each row: title, status badge, recipient count, scheduled date, open/click rates
- Click to open review panel

**Campaign Review Panel** (Sheet, same pattern as PostReviewPanel):
- Subject line preview with edit
- Body preview (rendered HTML)
- Audience preview (segment rules + estimated count + domain breakdown)
- Schedule selector
- Approve / Edit / Decline buttons
- Variant selector for A/B tests

**Create Campaign Dialog** (same pattern as CreateContentDialog):
- Campaign type selector (nurture, newsletter, follow-up, winback, announcement)
- Brief/prompt input for AI generation
- Manual creation option
- Segment builder (customer type, last order date, lead stage, etc.)

### New: `src/components/email-marketing/` directory
- `CampaignReviewPanel.tsx` -- Side panel for reviewing/approving campaigns
- `CampaignCard.tsx` -- List item component
- `CreateCampaignDialog.tsx` -- Campaign creation dialog
- `SegmentBuilder.tsx` -- Visual audience segment builder
- `SuppressionManager.tsx` -- View/manage suppression list

### Route Addition
Add `/email-marketing` to router, accessible to admin/office/sales roles.

## Phase 4: Suppression and Consent Management

### Unsubscribe Flow
- Every marketing email includes a unique unsubscribe link: `/unsubscribe?token=<signed_jwt>`
- New edge function `email-unsubscribe` validates token, inserts into `email_suppressions`, updates `email_consent_events`
- New minimal public page `src/pages/Unsubscribe.tsx` confirming removal

### Bounce/Complaint Handling
- `email-campaign-send` checks Gmail API response for bounces
- Bounced emails auto-added to `email_suppressions` with reason `bounce`
- Future: Gmail webhook integration for complaint signals

## Phase 5: Analytics and Learning (Future)

- Track opens via pixel (requires proxy setup -- defer)
- Track clicks via redirect links (defer)
- Campaign performance dashboard
- AI learning from engagement data to improve future campaigns
- A/B test result analysis and auto-winner selection

## Technical Details

### Files to Create
- `src/pages/EmailMarketing.tsx`
- `src/components/email-marketing/CampaignReviewPanel.tsx`
- `src/components/email-marketing/CampaignCard.tsx`
- `src/components/email-marketing/CreateCampaignDialog.tsx`
- `src/components/email-marketing/SegmentBuilder.tsx`
- `src/components/email-marketing/SuppressionManager.tsx`
- `src/pages/Unsubscribe.tsx`
- `src/hooks/useEmailCampaigns.ts`
- `supabase/functions/email-campaign-generate/index.ts`
- `supabase/functions/email-campaign-send/index.ts`
- `supabase/functions/email-unsubscribe/index.ts`

### Files to Modify
- `src/App.tsx` -- Add route for `/email-marketing` and `/unsubscribe`
- `src/components/office/OfficeNavItems.tsx` (or equivalent nav) -- Add Email Marketing nav item
- `supabase/config.toml` -- Add new edge function configs with `verify_jwt = false`

### Key Design Decisions
1. **Gmail as ESP**: Using existing `gmail-send` infrastructure rather than a dedicated ESP. Limits scale (~500/day per Google account) but avoids new vendor costs. Upgrade path: swap send engine to dedicated ESP later.
2. **Suppression is a hard gate**: Campaign send engine refuses to execute if suppression check fails.
3. **Consent-first**: No contact receives marketing email without an explicit consent record.
4. **AI generates, humans approve**: Campaign status must pass through `pending_approval` -> human sets `approved_by` -> only then can send engine execute.
5. **Follows existing patterns**: Uses same auth middleware, rate limiting, Lovable AI gateway, and UI patterns as Social Media Manager.

