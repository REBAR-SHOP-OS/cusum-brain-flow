

## Plan: Confirm Button Saves Snapshot & Shows Chat-like Summary in RECENTS

### Problem
Currently, the confirm icon (✓) only sets `due_date` on items. When a date appears in RECENTS and is clicked, it just filters the purchasing list. The user wants:
1. Clicking confirm should **save a snapshot** of all items with their statuses (approved/rejected/pending) for that date
2. RECENTS should show confirmed dates, and clicking one should display a **chat-like summary** of what was purchased, rejected, etc.

### Changes

**1. New DB table: `purchasing_confirmed_lists`**
- `id`, `company_id`, `confirmed_by`, `confirmed_at`, `due_date`, `snapshot` (JSONB — array of items with title, category, status), `created_at`
- RLS: users can read/insert for their own company

**2. Update `src/hooks/usePurchasingList.ts`**
- Modify `confirmList` to also insert a snapshot row into `purchasing_confirmed_lists` with all current items' statuses serialized as JSON

**3. Update `src/hooks/usePurchasingDates.ts`**
- Fetch from `purchasing_confirmed_lists` instead of (or in addition to) raw item dates, so RECENTS shows only **confirmed** lists

**4. Update `src/components/agent/AgentHistorySidebar.tsx`**
- No structural change — dates already render in RECENTS

**5. New component: `src/components/purchasing/PurchasingConfirmedView.tsx`**
- A chat-like view that displays the confirmed snapshot for a selected date
- Shows items grouped by category with visual indicators: ✅ purchased (green), ❌ rejected (red), ⏳ pending (grey)
- Header shows date, confirmed by, and timestamp

**6. Update `src/pages/AgentWorkspace.tsx`**
- When a RECENTS date is clicked, check if a confirmed snapshot exists
- If yes, show `PurchasingConfirmedView` instead of the editable `PurchasingListPanel`
- If no confirmed snapshot, show the editable panel as before (for backward compat)

### Flow
```text
User works on list → clicks ✓ confirm → snapshot saved to DB
                                       → date appears in RECENTS
User clicks RECENTS date → reads snapshot → shows chat-like summary
```

### Summary
| Change | File |
|--------|------|
| New migration | `purchasing_confirmed_lists` table |
| Save snapshot on confirm | `usePurchasingList.ts` |
| Fetch confirmed dates | `usePurchasingDates.ts` |
| Chat-like confirmed view | New `PurchasingConfirmedView.tsx` |
| Switch view on date click | `AgentWorkspace.tsx` |

