

## Add Assignee Dropdown to Schedule Activity Form

### Problem
The "Schedule Activity" form in `SalesLeadChatter` has activity type and date pickers but no assignee selector. The `assignees` prop is already passed to the component but not used in the activity form.

### Changes

**File**: `src/components/sales/SalesLeadChatter.tsx`
1. Add state: `const [assignedName, setAssignedName] = useState("")`
2. In the activity composer (after the date input, line ~274), add an assignee `Select` dropdown populated from the existing `assignees` prop
3. Pass `assignedName` in the `user_name` field when creating the activity via `create.mutate()`

Layout after change:
```text
[📞 Follow-up ▾] [03/24/2026] [Assign to... ▾]
[Activity description...                       ]
```

| File | Change |
|---|---|
| `src/components/sales/SalesLeadChatter.tsx` | Add assignee Select dropdown in activity form |

