

## Fix: Stale/Duplicate Suggestions + Auto-Create Next Activity on Comment

### Problem 1: Stale Suggestions Still Showing

The auto-resolve code we added to `generate-suggestions` works correctly but has two issues:

- **Threshold too strict**: It only resolves when `balance <= 0`, but there are invoices with trivial balances ($0.01, $0.66, $1.00) that are essentially paid. These should be auto-resolved too.
- **Never ran yet**: The edge function hasn't been triggered since the code was deployed. We need to trigger it and also do a one-time database cleanup for the 3 near-zero-balance suggestions.

**Fix**: Change the auto-resolve threshold from `balance <= 0` to `balance < 2` (under $2 is effectively paid). Then run immediate cleanup.

**File: `supabase/functions/generate-suggestions/index.ts`** (~line 93)
```
// Before:
if (balance === undefined || balance === null || balance <= 0)

// After:
if (balance === undefined || balance === null || balance < 2)
```

**One-time data fix**: Resolve the 3 suggestions where balance < $2 (GTC-CANADA $0.01, COSS $0.66, 1000558934 $1.00).

---

### Problem 2: No "Next Activity" Auto-Created After Comment

When a user posts a comment on a task, no follow-up activity is scheduled. The fix adds automatic creation of a "follow_up" scheduled activity due the next business day after each comment.

**File: `src/pages/Tasks.tsx`** — in the `postComment` function (after successful insert, ~line 434):

```typescript
// After comment is saved successfully, auto-create a follow-up activity
await supabase.from("scheduled_activities").insert({
  company_id: companyRes.data?.company_id,
  entity_type: "task",
  entity_id: selectedTask.id,
  activity_type: "follow_up",
  summary: `Follow up on comment`,
  due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), // tomorrow
  assigned_to: currentProfileId,
  status: "planned",
  created_by: user?.id,
});
```

This ensures every comment triggers a visible follow-up reminder in the task's activity section.

---

### Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/generate-suggestions/index.ts` | Raise auto-resolve threshold from `<= 0` to `< 2` |
| `src/pages/Tasks.tsx` | Auto-create follow-up scheduled activity after posting a comment |
| Database (one-time) | Resolve 3 near-zero-balance suggestions immediately |

