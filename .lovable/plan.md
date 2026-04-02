

# Fix: Order Calculator Upload Silent Failure for neel@rebar.shop

## Analysis

The Order Calculator (`OrderCalcView.tsx`) is 100% client-side — parsing uses `@e965/xlsx` with `FileReader`, no user/role-specific logic. The `rebar_sizes` table has open SELECT for all authenticated users. Since the same file works for `sattar@rebar.shop` but not `neel@rebar.shop`, the most likely cause is a **silent error** in the `handleFile` function (line 169-177), which has **no try/catch**. If `read()` or `parseRows()` throws for any reason (e.g., a subtle browser/session issue), nothing happens — no error, no feedback.

## Changes

### `src/components/office/OrderCalcView.tsx`

1. **Add try/catch with toast feedback** to `handleFile`:
   - Wrap the xlsx `read()`, `sheet_to_json()`, and `parseRows()` calls in try/catch
   - Show a toast error with the failure reason so the user (and us) can see what went wrong
   - Show a toast warning if parsing succeeds but produces 0 items ("No rebar items found")

2. **Add error state** to display inline feedback in the upload zone when parsing fails

3. **Import toast** from sonner

### Expected outcome
- If the file parses correctly → works as before (image #2)
- If parsing fails → user sees a clear error message instead of silent nothing
- This will either fix the issue (if it's a transient error) or surface the real cause

### Files changed
| File | Change |
|------|--------|
| `src/components/office/OrderCalcView.tsx` | Add try/catch + toast to `handleFile`, add error state display |

