

## Show Individual Cards for Unassigned Posts

### Problem
Currently, `groupByPlatform()` in `SocialCalendar.tsx` groups all unassigned posts into ONE card showing `? ×5`. The user wants each unassigned post to appear as its own separate card with the `?` icon and its specific time (6:30, 7:30, 8:00, 12:30, 2:30).

When a platform is assigned to a post, it naturally stops being "unassigned" and the `?` card disappears — this already works via the existing `handlePlatformsSaveMulti` + realtime subscription.

### Solution
Modify `groupByPlatform()` to treat each `unassigned` post as its own group (keyed by post ID) instead of grouping them together.

### File: `src/components/social/SocialCalendar.tsx`

**Change `groupByPlatform` function (lines 13-23)**:

```typescript
function groupByPlatform(posts: SocialPost[]) {
  const map = new Map<string, SocialPost[]>();
  for (const p of posts) {
    // Each unassigned post gets its own group (separate card)
    const key = p.platform === "unassigned" ? `unassigned_${p.id}` : (p.platform || "other");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return [...map.entries()].sort(
    ([a], [b]) => {
      // Normalize keys back to platform names for ordering
      const aPlatform = a.startsWith("unassigned") ? "unassigned" : a;
      const bPlatform = b.startsWith("unassigned") ? "unassigned" : b;
      return (PLATFORM_ORDER.indexOf(aPlatform) === -1 ? 99 : PLATFORM_ORDER.indexOf(aPlatform))
           - (PLATFORM_ORDER.indexOf(bPlatform) === -1 ? 99 : PLATFORM_ORDER.indexOf(bPlatform));
    }
  );
}
```

And update the platform icon lookup (line 151) to handle the `unassigned_xxx` key:

```typescript
const pIcon = platformIcons[platform.startsWith("unassigned") ? "unassigned" : platform] || platformIcons.twitter;
```

### Result
- Auto-generate → 5 individual `?` cards, each showing its scheduled time (6:30 AM, 7:30 AM, etc.)
- Assign platform → `?` card disappears, replaced by platform-specific card
- Other platforms (facebook, instagram, etc.) still group normally

