

# Brand All Outgoing Emails with Logo + Actor Signature

## Problem
The `notify-lead-assignees` function sends plain-text emails with no branding — no logo, no HTML styling, and no signature from the person who performed the action. Other functions (`comms-alerts`, `email-activity-report`) use HTML but also lack the company logo and actor signature. The `gmail-send` function already appends the user's `email_signatures` record — but the notification functions don't.

## What Changes

### 1. Create a shared branded HTML email builder
**File**: `supabase/functions/_shared/brandedEmail.ts`

A reusable function that wraps any email body in a branded HTML template:
- **Logo**: Rebar.shop logo from `public/brand/rebar-logo.png` (hosted at `https://cusum-brain-flow.lovable.app/brand/rebar-logo.png`)
- **Header**: Logo + "Rebar.shop" text
- **Body**: The actual content (HTML)
- **Signature block**: The actor's name, title/role if available, pulled from the `email_signatures` table or a fallback formatted block with the actor's name
- **Footer**: "Rebar.shop ERP — Automated Notification"
- Consistent font family, colors matching the app's design system

### 2. Update `notify-lead-assignees/index.ts`
- Accept `actor_id` (user ID) in addition to `actor_name`
- Fetch the actor's `email_signatures.signature_html` from DB using `actor_id`
- Convert the plain-text email body to HTML
- Wrap with the branded template from step 1 (logo header + signature footer)
- Change `Content-Type` from `text/plain` to `text/html`
- Customer emails get a clean professional version (no internal links, branded with signature)
- Internal emails get the same branding + "View record" link

### 3. Update callers to pass `actor_id`
- **`src/components/sales/SalesLeadChatter.tsx`** (line ~206): Add `actor_id: currentUserId` to the invoke body
- **`src/pages/sales/SalesPipeline.tsx`** (line ~242): Add `actor_id` from the current user session

### 4. Update `comms-alerts` email template
- Add the Rebar.shop logo to the `buildAlertHTML` function header
- Already uses HTML; just needs the logo image added to the header bar

### 5. Update `email-activity-report` email template
- Add the Rebar.shop logo to the report HTML header

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/_shared/brandedEmail.ts` | New — shared branded HTML email wrapper with logo + signature |
| `supabase/functions/notify-lead-assignees/index.ts` | Use branded HTML, fetch actor signature, accept `actor_id` |
| `supabase/functions/comms-alerts/index.ts` | Add logo to alert email header |
| `supabase/functions/email-activity-report/index.ts` | Add logo to report email header |
| `src/components/sales/SalesLeadChatter.tsx` | Pass `actor_id: currentUserId` in invoke body |
| `src/pages/sales/SalesPipeline.tsx` | Pass `actor_id` from session in stage-change invoke |

## Technical Notes
- Logo URL: `https://cusum-brain-flow.lovable.app/brand/rebar-logo.png` (publicly hosted)
- Actor signature: fetched from `email_signatures` table by `actor_id`; falls back to a simple "— {actor_name}, Rebar.shop" block if no signature configured
- All 3 email-sending functions will be redeployed after changes

