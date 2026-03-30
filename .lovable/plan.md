

# Show Customer Address on Rebar Tags

## Problem
The Ref section on rebar tags shows the address only if the individual row has an `address` value (extracted from the source spreadsheet). Most rows don't have per-row addresses, but the **session** always has a `site_address` field entered by the user. This fallback isn't being used.

## Fix

### 1. `src/components/office/TagsExportView.tsx`
Pass the session's `site_address` as fallback when the row's `address` is empty:
```
address={row.address || selectedSession?.site_address || ""}
```
Apply in both the card view (line ~477) and CSV export (line ~115).

### 2. `src/pages/PrintTags.tsx`
The print page only has `sessionId`, not the session object. Fetch the session's `site_address` from `extract_sessions` table and use it as fallback:
- Query `extract_sessions` for `site_address` using `sessionId`
- Pass `address={row.address || sessionAddress || ""}` to each `RebarTagCard`

### Files Changed
- `src/components/office/TagsExportView.tsx` — use session `site_address` as address fallback
- `src/pages/PrintTags.tsx` — fetch session `site_address`, use as fallback

