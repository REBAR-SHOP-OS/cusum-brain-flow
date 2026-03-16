

# Fix: Accurate Status Display on Calendar Cards

## Problem
The calendar groups posts by platform+title and shows a single "worst" status via `worstStatus()`. This means if one post in a group is "published" but another is "scheduled", the card shows "scheduled" — hiding the true status of individual posts. The user wants each card to accurately reflect the real status of all posts in the group.

## Solution

### `src/components/social/SocialCalendar.tsx`

**1. Replace `worstStatus` with a summary that shows the actual status breakdown:**
- If all posts in the group share the same status → show that status
- If mixed → show the dominant status with a count, e.g. "4 Published · 2 Scheduled"

**2. Show per-post status more clearly:**
- "Published ✅" for published
- "Scheduled 📅" for scheduled  
- "Draft" for draft
- "Pending Approval ⏳" for pending_approval
- "Declined ❌" for declined

**3. Update the status line (lines 215-231) to display a compact but accurate breakdown:**

```tsx
// Instead of single worstStatus, compute a status summary
const statusCounts = posts.reduce((acc, p) => {
  acc[p.status] = (acc[p.status] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

// Display: if all same → single label; if mixed → "3 Published · 1 Scheduled"
```

**4. Card border color uses the dominant (most common) status instead of worst.**

These changes ensure every card — video or image — shows its true publication state.

