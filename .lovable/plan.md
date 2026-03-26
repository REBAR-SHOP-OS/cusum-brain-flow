

# Show Email Notification Outcome (Green/Red) in Timeline

## Problem
When a note with @mentions is logged, the notification email is sent as fire-and-forget with no visual feedback. The user wants to see green if emails were sent successfully and red if they failed.

## Approach
Capture the response from `notify-lead-assignees` and display a small status indicator on the activity item in the timeline. The edge function already returns `{ sent, total }`.

## Changes

### `src/components/sales/SalesLeadChatter.tsx`

1. **Track notification outcomes** — Add a `useState<Record<string, "success" | "failed">>` map keyed by activity body hash or timestamp
2. **Await the notification call** — Instead of fire-and-forget, await `notify-lead-assignees` response after note is logged, and store the outcome
3. **Pass outcome to ActivityItem** — Show a small green `CheckCircle2` or red `XCircle` icon next to notes that triggered email notifications
4. **Visual indicators**:
   - Green icon + "Email sent" text when `sent > 0` and `sent === total`
   - Orange icon + "Partial: X/Y sent" when `sent > 0 && sent < total`
   - Red icon + "Email failed" when `sent === 0` or error

### `src/components/sales/SalesLeadDrawer.tsx`

1. **ComposeEmailDialog outcome** — After `ComposeEmailDialog` closes successfully, log an `email` type activity with success status. On failure, show red indicator.

### Implementation Detail

The notification result will be stored in a local state map (`emailOutcomes`) keyed by the activity's `created_at` timestamp. When a note is submitted:

```
create.mutate(..., {
  onSuccess: async () => {
    // ... existing logic ...
    try {
      const { data } = await supabase.functions.invoke("notify-lead-assignees", { body: {...} });
      // Store outcome: green if sent > 0, red otherwise
      setEmailOutcomes(prev => ({ ...prev, [timestamp]: data?.sent > 0 ? "success" : "failed" }));
    } catch {
      setEmailOutcomes(prev => ({ ...prev, [timestamp]: "failed" }));
    }
  }
});
```

In `ActivityItem`, if the activity has mentions and an outcome exists:
- Green: `✓ Email sent (2/2)` 
- Red: `✗ Email failed`

| File | Change |
|---|---|
| `SalesLeadChatter.tsx` | Await notification response, store outcome, show green/red indicator on activity items |

