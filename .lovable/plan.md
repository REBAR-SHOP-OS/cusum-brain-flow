

# Show Error Details + Retry Button on Email Failure

## Problem
When email notification fails, the UI just shows "Email failed to send" with no reason or way to retry. User wants to see the error message and have an autofix/retry option.

## Changes

### `src/components/sales/SalesLeadChatter.tsx`

1. **Store error details alongside outcome**: Change `emailOutcomes` state from `Record<string, string>` to `Record<string, { status: string; error?: string; noteBody?: string }>` so we capture the error message from the edge function response.

2. **Capture error message from response**: In the notification invoke block, extract `notifyError?.message` or `notifyResult?.error` and store it in the outcome object.

3. **Add retry function**: Create a `retryEmail` handler that re-invokes `notify-lead-assignees` with the stored note data and updates the outcome on success/failure.

4. **Update the failed indicator UI**: Replace the static "Email failed to send" text with:
   - Error reason text (e.g., "Gmail token expired", "No assignees found")
   - A "Retry" button that calls the retry handler
   - On retry success, update the indicator to green

### Implementation detail

```text
Current:  ✗ Email failed to send

New:      ✗ Email failed: Gmail token expired — re-authorize Gmail
          [🔄 Retry]
          
          OR if error is unknown:
          ✗ Email failed to send
          [🔄 Retry]
```

The retry button re-fires the same `notify-lead-assignees` call. On success it flips the indicator to green.

| File | Change |
|---|---|
| `SalesLeadChatter.tsx` | Store error details in emailOutcomes, show error reason, add retry button |

