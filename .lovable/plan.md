

## Enhance Deep Business Scan — Full Email Intelligence + Project Correlation

### Problem

The current `deep_business_scan` tool has three limitations that prevent Vizzy from truly "understanding" the business:

1. **Email previews truncated to 300 chars** — not enough to understand content
2. **No thread grouping** — emails about the same project/topic aren't correlated
3. **No cross-domain linking** — emails aren't connected to their related leads, orders, or customers
4. **`get_employee_emails` only shows 100 chars** — even less useful

### Enhancements (1 file)

**File**: `supabase/functions/admin-chat/index.ts`

#### Fix 1: Increase email preview lengths

- In `deep_business_scan` handler: increase `body_preview` slice from 300 → 800 chars for both `unansweredItems` and `recentItems`
- In `get_employee_emails` handler (line 1063): increase from 100 → 500 chars
- Return more emails: increase `recentItems` from 20 → 50, `unansweredItems` from 10 → 25

#### Fix 2: Group emails by thread

In the emails section of `deep_business_scan`, after collecting emails, group by `thread_id` to show conversation threads:
- Group emails sharing the same `thread_id`
- For each thread: show subject, participants, message count, latest message time, direction flow (who replied to whom)
- This lets Vizzy see "this thread has 5 messages between us and XYZ Company, last reply was from them 2 days ago — unanswered"

#### Fix 3: Cross-reference emails with leads/customers

After collecting emails and pipeline data (when `focus === "all"`):
- Match email addresses from communications against `contact_email` in leads
- Flag emails that are from/to active lead contacts
- Add `relatedLead` field to email items showing the lead title + stage

#### Fix 4: Add `orders` to the scan

Currently missing — add an orders query when `scanAll`:
- Query `orders` table for the date range
- Show order count, total revenue, status breakdown
- Cross-reference customer emails with order contacts

### Technical Detail

All changes are within the existing `case "deep_business_scan"` handler. The thread grouping is a post-processing step on the already-fetched email data. The cross-referencing uses leads data already fetched by the pipeline query. No new DB queries beyond the orders query.

### Files Changed

| File | Change | Category |
|---|---|---|
| `supabase/functions/admin-chat/index.ts` | Enhance deep scan: longer previews, thread grouping, cross-references, orders | Safe edit (same handler) |

### What is NOT changed
- Tool parameters unchanged
- No schema changes
- No new edge functions
- Other tools unaffected

