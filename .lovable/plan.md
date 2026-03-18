

## Plan: Add Error State UI + Retry for Extract Sessions

### Problem
When extraction fails (session status = "error"), the UI shows a blank screen with only a Decline button. There's no error message displayed and no way to retry.

### Root Cause
`getStepIndex("error")` returns -1, so none of the conditional content blocks render. The Decline button is the only element not gated by step index.

### Changes — `src/components/office/AIExtractView.tsx`

**1. Add error state rendering block** (after the "extracting" animation block, ~line 1470)
- When `activeSession.status === "error"`, show an error card with:
  - Error icon + "Extraction Failed" title
  - The `error_message` from the session (fetched via a query)
  - A **"Retry Extraction"** button that re-invokes `runExtract` with the same file
  - The existing Decline button remains available

**2. Fetch error_message from session**
- The `extract_sessions` table has an `error_message` column. Need to check if it's included in the session data already fetched. If not, add it to the query or read it separately.

**3. Query for error_message**
- Check if `fetchExtractSessions` already returns `error_message`. If not, add it to the select or use a separate small query.

### Additional context
- The latest session `aae5f582` failed with `invalid input syntax for type numeric: "0'-4""` — which the `parseDimension` fix should now handle on retry
- The edge function has been redeployed with the fix, so retry should succeed

### Files to modify
- `src/components/office/AIExtractView.tsx` — add error state UI block with retry logic

