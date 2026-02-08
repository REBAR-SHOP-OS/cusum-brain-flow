

# Fix: Full Activity Pipeline -- Email, Calls, Orders, Quotes, Leads

## Problem Summary

The customer activity panel (`InboxCustomerContext`) is broken in several critical ways, preventing it from pulling data across all connected services (Gmail, RingCentral, QuickBooks/CRM). Here's what's wrong:

---

## Issues Found

### 1. Sync Functions Missing `company_id` (Critical)
Both `gmail-sync` and `ringcentral-sync` edge functions **do not set `company_id`** when upserting into the `communications` table. The column is `NOT NULL`, so:
- Existing records only work because they were backfilled by a one-time migration
- **Any new sync will silently fail** because it violates the NOT NULL constraint

### 2. Leads Query Uses Non-Existent Columns
The `InboxCustomerContext` queries leads using:
```
.or('contact_email.ilike.%email%,company_name.ilike.%name%')
```
But the `leads` table has **neither** `contact_email` **nor** `company_name` columns. Leads are linked via `customer_id` and `contact_id` foreign keys. This query always returns zero results.

### 3. Quotes Table Missing `company_id`
The `quotes` table does not have a `company_id` column, so the query in `InboxCustomerContext` that filters by `customer_id` is the only correct path. However, quotes are only fetched if a `customer_id` is found -- which fails when the contact lookup doesn't match.

### 4. Customer Matching is Email-Only
The contact lookup only matches by email address (`contacts.email ILIKE '%senderEmail%'`). For RingCentral calls/SMS, the `from_address` is a **phone number** (e.g., `+14168606118`), so the context panel shows nothing for call/SMS records.

### 5. No Company Scoping on Activity Queries
The `InboxCustomerContext` queries `communications`, `orders`, `quotes`, `leads`, and `team_meetings` **without filtering by `company_id`**, relying entirely on RLS. While RLS provides safety, the component should be explicit about company scoping for clarity and performance.

---

## Fix Plan

### Step 1: Fix Edge Functions -- Add `company_id` to Sync

**Files:** `supabase/functions/gmail-sync/index.ts`, `supabase/functions/ringcentral-sync/index.ts`

Both functions need to:
1. Look up the user's `company_id` from the `profiles` table using the authenticated `user_id`
2. Include `company_id` in every `communications` upsert

```
// Add after getting userId:
const { data: profile } = await supabaseAdmin
  .from("profiles")
  .select("company_id")
  .eq("user_id", userId)
  .maybeSingle();
const companyId = profile?.company_id;
if (!companyId) throw new Error("No company found for user");

// Then include in every upsert:
{ ...existingFields, company_id: companyId }
```

### Step 2: Fix Leads Query in Customer Context

**File:** `src/components/inbox/InboxCustomerContext.tsx`

Replace the broken leads query with a proper join-based approach:
- If a `customer_id` is found from the contact lookup, query leads by `customer_id`
- If a `contact_id` is found, also query leads by `contact_id`
- As a fallback, search leads by matching the customer name in the lead `title`

```
// Instead of: .or('contact_email.ilike...,company_name.ilike...')
// Use:
custId
  ? supabase.from("leads").select("*").eq("customer_id", custId)
  : supabase.from("leads").select("*").ilike("title", `%${senderName}%`)
```

### Step 3: Add Phone Number Matching for Contacts

**File:** `src/components/inbox/InboxCustomerContext.tsx`

Extend the contact lookup to also match by phone number, so RingCentral calls/SMS show customer context:

```
// First try email match
let contactData = await supabase.from("contacts")
  .select("*, customers(*)")
  .ilike("email", `%${senderEmail}%`)
  .limit(1);

// If no match and it looks like a phone number, try phone match
if (!contactData?.length && /^\+?\d/.test(senderEmail)) {
  const digits = senderEmail.replace(/\D/g, "").slice(-10);
  contactData = await supabase.from("contacts")
    .select("*, customers(*)")
    .ilike("phone", `%${digits}%`)
    .limit(1);
}
```

### Step 4: Increase Communications Limit in Context Panel

**File:** `src/components/inbox/InboxCustomerContext.tsx`

The current limit of 30 for communications is too low. Increase to 100 to capture a fuller history of interactions with each contact.

### Step 5: Add Meetings to Activity Timeline

The code already fetches `team_meetings` but never adds them to the `allActivities` array. Add meeting entries to the unified timeline.

---

## Data Flow After Fix

```text
+------------------+     +-----------------+     +-------------------+
|  Gmail Sync      |---->|                 |     | InboxCustomerCtx  |
|  (+ company_id)  |     | communications  |<----|  1. Email match   |
+------------------+     |    table        |     |  2. Phone match   |
                          |                 |     |  3. customer_id   |
+------------------+     +-----------------+     +--------+----------+
|  RingCentral     |---->|                 |              |
|  (+ company_id)  |     |                 |     +--------v----------+
+------------------+     +-----------------+     | Parallel Queries  |
                                                  |  - leads (by FK)  |
                                                  |  - orders (by FK) |
                                                  |  - quotes (by FK) |
                                                  |  - meetings       |
                                                  |  - comms (email+  |
                                                  |    phone match)   |
                                                  +-------------------+
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/gmail-sync/index.ts` | Add company_id lookup and include in upsert |
| `supabase/functions/ringcentral-sync/index.ts` | Add company_id lookup and include in upsert |
| `src/components/inbox/InboxCustomerContext.tsx` | Fix leads query, add phone matching, add meetings to timeline, increase limits |

---

## Impact

- **Gmail emails** (including Odoo notifications, crm.rebar.shop, internal): Will sync correctly with company isolation and show full activity
- **RingCentral calls and SMS**: Will properly match to customer records via phone number
- **Leads/Opportunities**: Will correctly appear in the activity panel using proper foreign key relationships
- **Orders and Quotes**: Will continue working but now with proper customer matching from phone-based contacts too
- **New syncs**: Will no longer fail from missing `company_id`

