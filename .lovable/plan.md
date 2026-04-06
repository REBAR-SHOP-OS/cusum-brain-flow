

# Fix: Per-Page Green/Red Indicators for Published Posts with Partial Failures

## Problem

When the backend publishes to multiple pages and some fail, it sets `status = "published"` with `last_error = "Partial: Page "X": error; ..."`. But `parsePageStatuses()` on line 21 blindly returns `failed: false` for ALL pages when `status === "published"`, ignoring the partial error data.

Result: all 5 page indicators show green even when some pages actually failed.

## Fix

**File: `src/components/social/SocialCalendar.tsx`** — Update `parsePageStatuses` (line 21)

Remove the early return for `status === "published"`. Instead, check if there's a partial error in `last_error` even when published:

```tsx
// Line 19-22: Replace blind "all green" with partial-aware logic
return pages.map((name) => {
  const isPartial = lastError.toLowerCase().startsWith("partial");

  // Published with NO errors → green
  if (status === "published" && !lastError) return { name, failed: false };

  // Published with partial error → parse which pages failed
  if (status === "published" && isPartial) {
    const isFailed = lastError.includes(`Page "${name}"`) || lastError.includes(name);
    let error: string | undefined;
    if (isFailed) {
      const regex = new RegExp(`Page "${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}":\\s*([^;]+)`, "i");
      const match = lastError.match(regex);
      error = match?.[1]?.trim();
    }
    return { name, failed: isFailed, error };
  }

  // Full failure → all red
  if (status === "failed" && !isPartial) {
    // ... existing logic unchanged
  }

  // Non-published partial → same logic
  if (isPartial) {
    // ... existing logic unchanged  
  }

  // Draft/scheduled/pending → red (not published = red, per monitoring requirement)
  return { name, failed: true };
});
```

Key changes:
1. `status === "published"` no longer blindly returns all-green — it checks `last_error` for partial failures
2. Draft/scheduled/pending pages show **red** (monitoring: not published = red)
3. Only truly published pages with no errors show green

This is a single function change (~15 lines modified) in one file.

