
# Inbox Security Fix — User-Scoped Data Isolation

## Scope
Only these items change:
- **RLS policy** on `communications` table (database migration)
- **`src/hooks/useCommunications.ts`** — minor hardening of the client-side query

Zero changes to: InboxView.tsx, UI layout, categories, other pages, other tables, or any other logic.

---

## Root Cause Analysis

### Current RLS SELECT policy (broken)
```sql
-- Name: "Users read own or admin reads all communications"
-- Qual:
(company_id = get_user_company_id(auth.uid()))
AND (
  (user_id = auth.uid())
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
)
```

**The security hole**: Any user with the `office` role can read ALL 1,305 communications in the company, regardless of who owns them. This means an office employee can see Sattar's emails, Radin's emails, etc.

### Verified data integrity
- All 1,305 rows in `communications` have `user_id` populated (0 nulls) — every record is properly attributed to an owner.
- The `user_id` column links directly to `auth.users.id`, matching the OAuth token owner.

### Gmail Sync linkage
Communications are synced via the `gmail-sync` edge function which uses the `user_gmail_tokens` table (keyed by `user_id`) — so every synced email is correctly stamped with the correct `user_id`.

---

## What Changes

### 1. Database Migration — Fix RLS SELECT Policy

**Drop the broken policy and replace it with a strict one:**

```sql
-- Drop the overly-permissive policy
DROP POLICY IF EXISTS "Users read own or admin reads all communications" ON public.communications;

-- New: strict user isolation + admin-only override
CREATE POLICY "Users read own communications; admins read all"
ON public.communications
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
```

**What this enforces:**
- Every user sees only rows where `user_id = auth.uid()` (their own Gmail/RingCentral sync)
- Only `admin` role can read all company communications (for oversight / compliance)
- `office` role loses blanket access — they see only their own emails (same as all other users)
- All other policies (INSERT, UPDATE, DELETE) are untouched

### 2. `useCommunications.ts` — Server-Side Trust + Hardening

The hook currently does `.select("*")` with no user filter — it trusts RLS to do the scoping (which is the correct pattern). After the migration, RLS enforces isolation automatically.

One small hardening: add an explicit `eq("user_id", userId)` as a belt-and-suspenders guard on the client side so that even if RLS is ever misconfigured, the query still scopes correctly:

```typescript
// After: supabase.auth.getUser() at the top of the hook
let query = supabase
  .from("communications")
  .select("*")
  .eq("user_id", currentUserId)   // ← belt-and-suspenders client filter
  .order("received_at", { ascending: false })
  .limit(200);
```

This does not rely on client-provided parameters — it reads `auth.uid()` directly from the authenticated session, same as RLS.

---

## Role Access Matrix After Fix

| Role | Can See |
|------|---------|
| `admin` | All company communications |
| `office` | Own communications only |
| `sales` | Own communications only |
| `accounting` | Own communications only |
| `workshop` | Own communications only |
| `field` | Own communications only |

---

## What is NOT Changed

- `office` can still INSERT/UPDATE their own records (those policies are unchanged)
- Admin DELETE policy is unchanged
- InboxView.tsx — not touched
- Categories, labels, kanban view — not touched
- Any other page or module — not touched
- No new columns, no schema changes, no new tables

---

## Security Guarantee

After this fix:
- User A logs in → query hits RLS → only rows where `user_id = A.uid` returned
- User B logs in → query hits RLS → only rows where `user_id = B.uid` returned
- Direct API calls with a crafted `userId` parameter are irrelevant — RLS ignores client-side filters and enforces `auth.uid()` server-side
- Attempting to read another user's communication returns 0 rows (not 403 — this is how Supabase RLS works: unauthorized rows are silently excluded, not errored, which is the correct pattern for list queries)

---

## Files Changed

| File | Change |
|------|--------|
| Database migration | Drop old SELECT policy, create new strict one |
| `src/hooks/useCommunications.ts` | Add `eq("user_id", currentUserId)` belt-and-suspenders filter |

**Total scope: 1 migration + 1 small hook edit. Nothing else.**
