

## Make the Notification Center Interactive and Functional

### Problems
1. Clicking a notification with no `link_to` does nothing visible -- no detail view, no feedback
2. To-do items have no "mark done" action
3. No individual dismiss button on notifications
4. Descriptions are truncated with no way to expand them
5. No visual feedback when marking as read

### Solution

Make each notification item expandable inline and add action buttons.

---

### Changes

**File: `src/components/panels/InboxPanel.tsx`**

1. **Add expandable detail view**: Clicking a notification without a `link_to` toggles an expanded state showing the full description and metadata. Clicking one with a `link_to` still navigates.

2. **Add action buttons per item**:
   - Notifications: "Dismiss" button (X icon) on each item
   - To-dos: "Mark Done" checkmark button that calls `markActioned`
   - Ideas: "Dismiss" button

3. **Track expanded item**: Add `expandedId` state. When a user clicks an item without a link, toggle its expansion to show the full description and action buttons.

4. **Visual read feedback**: When an unread item is clicked, it visually transitions from the highlighted `bg-primary/10` to the muted `bg-secondary/50` state.

5. **Add individual dismiss**: Import and use the existing `dismiss` function from `useNotifications` (already available but unused in the panel).

### Detailed Code Plan

```
State additions:
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Also destructure `dismiss` from useNotifications (already returned but not used)

Click handler update:
  - If item has linkTo -> navigate (existing behavior)
  - If item has no linkTo -> toggle expandedId
  - Always markRead if unread

Each notification card:
  - Show full description when expanded (remove truncate/line-clamp)
  - Show action row when expanded:
    - Notifications: [Dismiss] button
    - To-dos: [Mark Done] [Dismiss] buttons
    - Ideas: [Dismiss] button
  - Show a subtle chevron or expand indicator

To-do section:
  - Add a small checkbox/checkmark button inline (always visible, not just on expand)
  - Clicking it calls markActioned(id) and removes the item
```

### What Does NOT Change
- Database schema (no changes)
- Backend / edge functions (no changes)
- useNotifications hook (no changes -- all functions already exist)
- Realtime subscription (no changes)
- Notification creation logic (no changes)

### Files Modified
| File | Change |
|------|--------|
| `src/components/panels/InboxPanel.tsx` | Add expand state, action buttons, detail view |

