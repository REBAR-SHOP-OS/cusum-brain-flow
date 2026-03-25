

## Remove "Not Purchased" Tab & Keep "Purchased" Always Visible

### What Changes

**File: `src/components/purchasing/PurchasingListPanel.tsx`**

1. Remove the "Not Purchased" (`pending`) entry from `STATUS_TABS` — only keep `All` and `Purchased`
2. Change `defaultFilterStatus` default from `"all"` to `"all"` (stays same — user sees all items by default)
3. The "New Chat" reset already clears DB items (implemented previously) — no change needed there

### Result
- Two tabs only: **All** | **Purchased**
- "Not Purchased" filter disappears completely
- Default view shows all items with no selections
- "New Chat" continues to reset everything as already implemented

| File | Change |
|---|---|
| `src/components/purchasing/PurchasingListPanel.tsx` | Remove `pending` tab from `STATUS_TABS` |

