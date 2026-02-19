
# Pipeline Full Visibility Fix

## Root Cause Analysis

After querying the database directly:
- **2816 total leads** exist in the DB — exactly matching Odoo's count shown in the screenshot
- The data is NOT missing from the database
- **43 leads have stage `"archived_orphan"`** — a stage that does NOT exist in `PIPELINE_STAGES` in `Pipeline.tsx` — these cards are silently invisible on the board because the board only renders columns for known stages
- The Odoo sync edge function calls `search_read` without paginating (`offset`/`limit` loop) — fragile if Odoo applies its default server-side cap in the future
- No hidden user-based domain filters exist ✓
- Sync mode `full` is accessible from the menu but not restricted to admin-only

---

## Deliverables — What Gets Fixed

### Fix 1: Add "archived_orphan" Stage to Pipeline Board
**File:** `src/pages/Pipeline.tsx` — `PIPELINE_STAGES` constant

Add the missing stage:
```ts
{ id: "archived_orphan", label: "Archived / Orphan", color: "bg-zinc-700" }
```
This makes the 43 currently-invisible leads appear in their own column.

Also add to the `STAGE_MAP` in the edge function so future syncs respect this stage label:
**File:** `supabase/functions/odoo-crm-sync/index.ts`

---

### Fix 2: Paginated Odoo Fetch (Prevents Future Data Loss)
**File:** `supabase/functions/odoo-crm-sync/index.ts`

Replace the single unbounded `search_read` call with a paginated loop:

```
1. Call search_count to get total records in domain → logs the expected total
2. Loop with BATCH=500, offset 0, 500, 1000... until all fetched
3. Merge all batches into one array
4. Log "Fetched X / Y expected" for transparency
```

This ensures all current and future leads are synced regardless of Odoo's server limit.

---

### Fix 3: Restrict "Odoo Sync" to Admin-Only
**File:** `src/pages/Pipeline.tsx` — the dropdown menu

The `isAdmin` variable is already available in the component. Add a conditional to hide the "Odoo Sync" dropdown item for non-admins:
```tsx
{isAdmin && (
  <DropdownMenuItem onClick={handleOdooSync} ...>
    ...Odoo Sync (Full)
  </DropdownMenuItem>
)}
```

---

## Summary of Changes

| File | Change | Leads Impacted |
|---|---|---|
| `src/pages/Pipeline.tsx` | Add `archived_orphan` to `PIPELINE_STAGES` | +43 visible cards |
| `supabase/functions/odoo-crm-sync/index.ts` | Add `"Archived"/"Orphan"` to STAGE_MAP | Future sync parity |
| `supabase/functions/odoo-crm-sync/index.ts` | Replace single `search_read` with paginated loop (batch=500) | Prevents future data loss |
| `src/pages/Pipeline.tsx` | Restrict "Odoo Sync" menu item to `isAdmin` only | Security hardening |

## Domain & Pagination Details (Required Deliverables)

- **Domain used:** `[["type", "=", "opportunity"]]` for full sync — no user_id filter, no hidden scope
- **Pagination:** `search_count` first → then loop `search_read` with `offset += 500` until `offset >= total`
- **Records confirmed in DB:** 2816 (matches Odoo)
- **Records currently invisible:** 43 (stage `archived_orphan` not in board columns)
- **No records are truncated or deleted** by this fix

No other part of the application is touched.
