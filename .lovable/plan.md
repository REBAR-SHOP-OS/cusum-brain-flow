

## Fix: Text Not Visible in Screenshots on Heavy Pages

### Problem

The CEO Portal `/home` page has over 3000 DOM elements, triggering the `isHeavyPage` flag. This sets `html2canvas` `scale` to `0.4`, which renders the screenshot at 40% resolution — making all text blurry and unreadable.

### Fix

**File: `src/components/feedback/ScreenshotFeedbackButton.tsx`** — Line 152

Increase the heavy-page scale from `0.4` to `0.75` so text remains legible while still keeping capture performant:

```typescript
// Before
scale: isHeavyPage ? 0.4 : 1,

// After
scale: isHeavyPage ? 0.75 : 1,
```

Also increase the heavy-page timeout from 8s to 12s (line 159) to accommodate the higher resolution:

```typescript
// Before
isHeavyPage ? 8000 : 15000

// After
isHeavyPage ? 12000 : 15000
```

### Why 0.75

- `0.4` — text unreadable (current)
- `0.75` — text clear, file size reasonable, capture still fast enough
- `1.0` — risks timeout on very heavy pages

Two lines changed in one file.

