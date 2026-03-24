

## Fix: Redeploy notify-lead-assignees & Add Error Visibility

### Problem
The `notify-lead-assignees` edge function has zero logs, meaning it was never successfully invoked. Most likely the function wasn't properly deployed after the transient network error. The frontend also silently swallows invocation errors with `.catch(() => {})`.

### Changes

1. **Redeploy the edge function** — Ensure `notify-lead-assignees` is live and callable.

2. **File: `src/components/sales/SalesLeadChatter.tsx`** (line 213)
   - Replace `.catch(() => {})` with `.catch((err) => console.error("notify-lead-assignees error:", err))` so failures are visible in the console for debugging.

3. **File: `src/pages/sales/SalesPipeline.tsx`** — Same change for the stage-change notification call.

| File | Change |
|---|---|
| Edge function deploy | Redeploy `notify-lead-assignees` |
| `SalesLeadChatter.tsx` | Log notification errors to console instead of swallowing |
| `SalesPipeline.tsx` | Log notification errors to console instead of swallowing |

