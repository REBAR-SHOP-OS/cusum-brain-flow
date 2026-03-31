

# Fix: Per-Page Green/Red Status Icons in Post Cards

## Problem
When a post fails, all page icons show as neutral gray circles instead of green (success) or red (failed). The current parsing logic only marks a page as failed if it's explicitly mentioned in `last_error` — but many errors don't include per-page details.

## Solution
Update `parsePageStatuses` in `SocialCalendar.tsx` to use correct defaults:

- **`published`** status → all pages green ✅ (already works)
- **`failed`** with NO "Partial" prefix → all pages red ❌ (full failure)
- **`failed`** with "Partial" prefix → pages mentioned in error = red, others = green
- **`scheduled` / `draft` / `pending_approval`** → neutral gray circles

### File: `src/components/social/SocialCalendar.tsx`

Update `parsePageStatuses` function (lines 17-32):

```typescript
return pages.map((name) => {
  if (status === "published") return { name, failed: false };
  
  const isPartial = lastError.toLowerCase().startsWith("partial");
  
  if (status === "failed" && !isPartial && !lastError) {
    // Full failure, no error details — all pages failed
    return { name, failed: true };
  }
  
  if (status === "failed" && !isPartial) {
    // Failed with error but not partial — all pages failed
    return { name, failed: true };
  }
  
  if (isPartial) {
    // Partial: pages mentioned in error = failed, rest = success
    const isFailed = lastError.includes(name);
    let error: string | undefined;
    if (isFailed) {
      const regex = new RegExp(`...escaped name...:\\s*([^;]+)`, "i");
      error = lastError.match(regex)?.[1]?.trim();
    }
    return { name, failed: isFailed, error };
  }
  
  return { name, failed: false };
});
```

## Impact
- 1 file changed (`SocialCalendar.tsx`)
- Failed posts: all pages show red ❌
- Partial failures: failed pages red, successful pages green
- Published posts: all pages green ✅ (unchanged)
- No backend changes

