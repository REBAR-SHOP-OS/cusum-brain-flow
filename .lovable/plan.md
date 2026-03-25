

## Reset Purchasing List on "New Chat"

### Problem
When "New Chat" is clicked, the component remounts but DB rows with `is_purchased=true` or `is_rejected=true` (and no `due_date`) persist, so default items still appear selected.

### Solution
Add a `resetItems` function to `usePurchasingList` that deletes all company items with no `due_date` from the database, effectively clearing all selections back to the clean default list.

Call this function from `handleNewChat` in `AgentWorkspace.tsx` before incrementing the key.

### Changes

| File | Change |
|---|---|
| `src/hooks/usePurchasingList.ts` | Add `resetItems()` — deletes all rows where `due_date IS NULL` for the user's company |
| `src/pages/AgentWorkspace.tsx` | Import and call `resetItems()` in `handleNewChat` before remounting the panel |

### Implementation Detail

**`usePurchasingList.ts`** — new function:
```typescript
const resetItems = useCallback(async () => {
  if (!user) return;
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
  if (!profile?.company_id) return;
  await supabase.from("purchasing_list_items").delete()
    .eq("company_id", profile.company_id)
    .is("due_date", null);
}, [user]);
```

**`AgentWorkspace.tsx`** — in `handleNewChat`:
- Create a standalone `resetPurchasingItems` function (or call the hook at workspace level)
- Before `setPurchasingKey(k => k + 1)`, await deletion of undated items so the remounted panel fetches a clean state

