

## Fix: Video Preview Shows "Not Available" — Stale Closure in Export

### Root Cause

**`handleExportInternal` reads `clips` from a stale React closure.**

The flow in `handleSubmit`:
1. Line 206: `setClips(initialClips)` — sets clips to idle
2. Lines 251-282: `setClips(prev => ...)` — updates clips to "completed" with videoUrls during generation loop
3. Line 290: `await handleExportInternal(...)` — tries to read completed clips

**But** `handleExportInternal` (line 366) is a `useCallback` that captures `clips` from its closure (line 374). When `handleSubmit` was created, `clips` was the *old* value. Even though `setClips` updates happen during the loop, the `clips` variable inside `handleExportInternal`'s closure still points to the initial empty/idle array.

Result: `completedClips.length === 0` at line 374 → returns early → `finalVideoUrl` stays `null` → "Video preview not available".

### Fix

**File: `src/components/ad-director/AdDirectorContent.tsx`**

1. **Add a `clipsRef`** that always holds the latest clips value:
```typescript
const clipsRef = useRef<ClipOutput[]>([]);
// Sync ref on every clips update
useEffect(() => { clipsRef.current = clips; }, [clips]);
```

2. **In `handleExportInternal`**: Read from `clipsRef.current` instead of `clips`:
```typescript
const completedClips = clipsRef.current.filter(c => c.status === "completed" && c.videoUrl);
```
And similarly for the `orderedClips` mapping that filters by `clip?.status === "completed"`.

3. **In `handleExport`** (user-triggered, line 421): Same fix — use `clipsRef.current`.

This ensures the export function always reads the latest clips regardless of React's closure timing.

### Files
- `src/components/ad-director/AdDirectorContent.tsx` — add `clipsRef`, use it in both export functions

