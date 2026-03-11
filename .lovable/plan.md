

## Keep Platform Cards Independent Per Time Slot

### Problem
Currently `groupByPlatform()` groups ALL posts of the same platform into one card (e.g., Facebook ×6 + Facebook ×12 = Facebook ×18). When an unassigned `?` card is scheduled, the new platform cards merge with existing cards from other content, losing the per-time-slot identity.

### Solution
Change the grouping key from just `platform` to `platform + title` (or `platform + scheduled_time`). This ensures that "Build Foundations..." Facebook ×6 at 6:30 AM stays separate from "The Backbone..." Facebook ×12 at 9:45 PM.

### File: `src/components/social/SocialCalendar.tsx`

**Change `groupByPlatform` function (lines 12-25)**:

Update the grouping key for assigned platforms to include the post title, so cards from different content remain independent:

```typescript
function groupByPlatform(posts: SocialPost[]) {
  const map = new Map<string, SocialPost[]>();
  for (const p of posts) {
    // Unassigned: each gets its own card
    // Assigned: group by platform + title so different content stays separate
    const key = p.platform === "unassigned"
      ? `unassigned_${p.id}`
      : `${p.platform || "other"}_${p.title || p.id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return [...map.entries()].sort(([a], [b]) => {
    const aPlatform = a.startsWith("unassigned") ? "unassigned" : a.split("_")[0];
    const bPlatform = b.startsWith("unassigned") ? "unassigned" : b.split("_")[0];
    return (PLATFORM_ORDER.indexOf(aPlatform) === -1 ? 99 : PLATFORM_ORDER.indexOf(aPlatform))
         - (PLATFORM_ORDER.indexOf(bPlatform) === -1 ? 99 : PLATFORM_ORDER.indexOf(bPlatform));
  });
}
```

Also update the platform icon lookup (around line 151) to extract platform name correctly:
```typescript
const platformName = platform.startsWith("unassigned") ? "unassigned" : platform.split("_")[0];
const pIcon = platformIcons[platformName] || platformIcons.twitter;
```

### Result
- "Build Foundations..." → Facebook ×6 card (6:30 AM) — independent
- "The Backbone..." → Facebook ×12 card (9:45 PM) — independent  
- Each `?` card's scheduled platforms stay as their own grouped cards, never merging with other content

