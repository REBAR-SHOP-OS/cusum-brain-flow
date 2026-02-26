

## Problem

"Apply Mapping" fails with "No rows to map" because `extractService.ts` inserts rows via the frontend client (with RLS), but **doesn't check the error result**. If the insert fails (e.g., RLS timing issue, role check), the error is silently swallowed. The session transitions to "extracted" status but has zero rows.

Looking at `extractService.ts` line ~160:
```typescript
await supabase.from("extract_rows").insert(rows as any);
// ← No error check!
```

Additionally, the `manage-extract` edge function already uses the **service role** client. The row insertion should also happen server-side (inside the edge function) rather than client-side, to bypass RLS entirely and ensure reliability.

## Fix

### `src/lib/extractService.ts` — `runExtract` function

1. **Remove the client-side row insertion** (lines ~137-165). The edge function `extract-manifest` should return the items, and the `manage-extract` edge function should handle persistence.

2. **OR (simpler):** Add error checking to the existing insert and throw if it fails:
```typescript
const { error: insertErr } = await supabase.from("extract_rows").insert(rows as any);
if (insertErr) throw new Error(`Failed to save rows: ${insertErr.message}`);
```

3. Also verify the session status update succeeds before returning.

### Recommended approach (option 2 — minimal change)

- Add `{ error: insertErr }` destructuring to the `extract_rows` insert call
- Throw on error so the toast shows the real failure reason instead of succeeding silently
- Add same error check to the session status update

This way if RLS blocks the insert, the user sees "Failed to save rows: ..." instead of silently proceeding to a broken "Extracted" state.

