

# Refine Vizzy's Email, QuickBooks, and Call Notes Integration

## What's Already Done
The previous implementation already added all three features (email context, call notes, live QuickBooks) to `supabase/functions/ai-agent/index.ts`. This plan applies your recommended refinements for reliability, performance, and maintainability.

## Changes

### 1. Add `direction = 'inbound'` Filter to Email Queries
The current email query only filters by `to_address ilike @rebar.shop` but doesn't filter by direction. This can pull outbound replies and internal forwards. Add `.eq("direction", "inbound")` to both queries.

**File:** `supabase/functions/ai-agent/index.ts` (lines 2013-2029)

- `allInboundEmails` query: add `.eq("direction", "inbound")` before the `.ilike("to_address", ...)` filter
- `callNotes` query: add `.eq("direction", "inbound")` -- these RingCentral summaries arrive as inbound emails
- Add error logging with `console.warn` for both queries instead of silently swallowing errors

### 2. Add `direction` and `source` columns to Call Notes Query
The current call notes select is missing `direction` and `source` columns which are useful for mapping employees. Add them.

**File:** `supabase/functions/ai-agent/index.ts` (line 2025)

- From: `.select("id, subject, from_address, to_address, body_preview, received_at")`
- To: `.select("id, subject, from_address, to_address, body_preview, received_at, direction, source")`

### 3. Extract QuickBooks Fetch into Shared Helper Function
Currently the QuickBooks live API code is duplicated between the `accounting` agent block (lines 1778-1898) and the `assistant` agent block (lines 2036-2119). Extract into a reusable `fetchQuickBooksLiveContext()` helper and call it from both agents.

**File:** `supabase/functions/ai-agent/index.ts`

- Create a new `async function fetchQuickBooksLiveContext(supabase, context)` that contains the shared QB logic (connection check, token retrieval, API calls for customers/invoices/payments/company info)
- Replace the accounting agent's QB block (lines 1778-1898) with a call to the helper
- Replace the assistant agent's QB block (lines 2036-2119) with a call to the same helper
- This prevents future drift where one agent gets QB updates but the other doesn't

### 4. Add Guardrail to Vizzy's System Prompt
Add the anti-hallucination instruction to the Employee Performance section.

**File:** `supabase/functions/ai-agent/index.ts` (after line 1259)

- Add: `Important: Only summarize what is explicitly present in emails/call notes. Do not make performance judgments without evidence. If information is missing, say so clearly.`

## Summary
- 1 file modified: `supabase/functions/ai-agent/index.ts`
- Inbound direction filter added to both email queries (prevents pulling outbound/internal noise)
- QuickBooks logic deduplicated into shared helper (prevents future drift)
- Anti-hallucination guardrail added to prompt
- Better error logging on email queries

