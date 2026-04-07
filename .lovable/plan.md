

# Add "Send Quote" Option from Lead Record on Sales Pipeline

## Problem
The lead detail drawer on `/sales/pipeline` shows linked quotation counts via `LeadSmartButtons`, but there's no way to send an existing quote to the customer directly from the lead record. Users must navigate away to the Quotations page to send.

## Approach
Enhance `LeadSmartButtons` to show a "Send Quote" action when quotes exist for the lead. Clicking it opens a small dialog listing the lead's quotations with a send button for each, which triggers the existing `send-quote-email` edge function.

## Changes

### 1. `src/components/sales/LeadSmartButtons.tsx`
- Expand the quotes query to also fetch `quotation_number`, `status`, `customer_name`, `amount`, and `quote_id` (the linked `quotes` table ID used by send-quote-email)
- Make the Quotes card clickable — clicking opens a dropdown/popover listing each quote with its number, status, and amount
- Each quote row has a **Send** button (Mail icon) that opens a small email dialog
- The email dialog collects customer email (pre-filled from lead's `contact_email` passed as a new prop), then calls `invokeEdgeFunction("send-quote-email", { quote_id, customer_email, action: "send_quote" })`
- After sending, update the quotation status to `sent_to_customer` and show a success toast

### 2. Props change
- Add `contactEmail?: string` prop to `LeadSmartButtons` so the email dialog can pre-fill
- Update `SalesLeadDrawer` (line 142) to pass `contactEmail={lead.contact_email}`

## Technical Details
- Reuses existing `send-quote-email` edge function — no backend changes
- The `quote_id` field on `sales_quotations` links to the `quotes` table, which is what `send-quote-email` expects
- Quotation status update uses the existing `sales_quotations` table update
- UI: Popover with quote list + inline Dialog for email input, matching existing patterns in the codebase

## Files
| File | Change |
|------|--------|
| `src/components/sales/LeadSmartButtons.tsx` | Add send-quote popover + email dialog |
| `src/components/sales/SalesLeadDrawer.tsx` | Pass `contactEmail` prop |

