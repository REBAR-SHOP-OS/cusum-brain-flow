

# Notification Center Audit and Improvements

## Issues Found

1. **No backdrop/overlay** -- Clicking outside the panel doesn't close it; no visual dimming of background content
2. **No priority indicator** -- The `priority` field (low/normal/high) is stored but never displayed visually
3. **No "Mark all read" action** -- Only "Dismiss all" exists; users can't bulk-mark as read
4. **Empty state is plain** -- Just text, no icon or visual warmth
5. **No tab-based filtering** -- All three sections (Notifications, To-do, Ideas) are always stacked vertically, requiring scrolling
6. **Dismiss button too close to expand chevron** -- Easy to accidentally dismiss when trying to expand
7. **No animation on open/close** -- Panel appears/disappears abruptly
8. **Section counts missing** -- No badge counts next to section headers
9. **No keyboard shortcut to close** -- Escape key doesn't close the panel

## Plan

### 1. Add backdrop overlay with click-to-close
- Render a semi-transparent backdrop behind the panel
- Click on backdrop closes the panel
- Add Escape key listener to close

### 2. Add tab navigation (Notifications | To-do | Ideas)
- Replace stacked sections with a simple tab bar at the top
- Each tab shows its count badge
- Cleaner UX, less scrolling

### 3. Show priority indicators
- High priority: red dot/left border accent
- Normal: no indicator (default)
- Low: subtle muted styling

### 4. Add slide-in animation
- Use CSS transition or framer-motion for smooth slide-in from left

### 5. Improve empty states
- Add contextual icons (Bell, CheckSquare, Lightbulb) per section
- Slightly larger, friendlier empty state

### 6. Add "Mark all read" button
- Add a "Mark all read" action in the hook and expose it in the Notifications tab header

### 7. Fix button layout
- Move dismiss (X) button to only show on hover or in expanded view
- Keep the expand chevron as the primary click affordance

---

## Technical Details

### Files Modified

| File | Changes |
|------|---------|
| `src/components/panels/InboxPanel.tsx` | Rewrite panel layout: add backdrop overlay, tab navigation with counts, priority indicators (colored left border), slide-in animation via framer-motion, improved empty states with icons, hover-reveal dismiss button, Escape key handler |
| `src/hooks/useNotifications.ts` | Add `markAllRead` function that bulk-updates all unread notifications to "read" status |

### Hook Addition (`useNotifications.ts`)
```typescript
const markAllRead = useCallback(async () => {
  const unreadIds = notifications
    .filter((n) => n.status === "unread")
    .map((n) => n.id);
  if (unreadIds.length === 0) return;
  await supabase
    .from("notifications")
    .update({ status: "read" })
    .in("id", unreadIds);
  setNotifications((prev) =>
    prev.map((n) => (n.status === "unread" ? { ...n, status: "read" as const } : n))
  );
}, [notifications]);
```

### UI Structure (InboxPanel)
- Backdrop: `fixed inset-0 bg-black/30 z-39` with onClick={onClose}
- Panel: animated with `framer-motion` (slideX from -320 to 0)
- Tab bar: three buttons (All | To-do | Ideas) with unread count badges
- Priority: `border-l-2 border-destructive` for high priority items
- Empty states: Icon + text per tab type
- Dismiss button: `opacity-0 group-hover:opacity-100` pattern

No database changes required.

