

## Show Verifier Name on Clearance Cards

### Problem
When items are cleared on the Clearance Station, the card shows a "Cleared" status but does not display who performed the verification. The `verified_by` user ID is stored in `clearance_evidence` but the verifier's name is never fetched or shown.

### Solution
Two changes are needed:

### 1. Update `src/hooks/useClearanceData.ts` — fetch verifier name

Modify the query to join `clearance_evidence` with `profiles` on `verified_by` to retrieve `full_name`.

- After fetching `clearance_evidence`, collect all non-null `verified_by` user IDs
- Query `profiles` table for those IDs to get `full_name`
- Map the verifier name into each `ClearanceItem`
- Add `verified_by_name: string | null` to the `ClearanceItem` interface

### 2. Update `src/components/clearance/ClearanceCard.tsx` — display verifier name

When the item is cleared (`isCleared === true`), show the verifier's name and timestamp below the "Cleared" button or in the header area:

```text
Cleared by John Smith · Feb 25, 2026
```

### Technical Details

**`useClearanceData.ts` changes:**
- Add `verified_by_name: string | null` to `ClearanceItem` interface
- After fetching evidence, collect unique `verified_by` IDs
- Query `profiles` for `id, full_name` where `id` in those IDs
- Build a lookup map and attach `verified_by_name` to each item

**`ClearanceCard.tsx` changes:**
- Access `item.verified_by_name` and `item.verified_at`
- When `isCleared`, render a small text line showing verifier name and date
- Format: `"Cleared by {name} · {date}"` or `"Cleared · {date}"` if name unavailable

No database changes required — the `verified_by` column already exists and stores user IDs. The `profiles` table already has `full_name`.
