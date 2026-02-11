

## Always-Visible Fix Request Queue

### Change
Update `src/components/ceo/FixRequestQueue.tsx` to always render on the CEO Portal instead of hiding when empty.

- **No requests**: Show a subtle, muted panel with the bug icon and a message like "No open fix requests — tell Vizzy to log one from the shop floor"
- **Has requests**: Show the current active list as it works today (no changes needed)

### Technical Detail

**File:** `src/components/ceo/FixRequestQueue.tsx`

Remove the early return (`if (requests.length === 0) return null;`) and replace it with an empty-state message inside the existing card container. The outer card shell (border, icon, title) always renders. When `requests.length === 0`, show a single line of muted text instead of the scrollable list.

