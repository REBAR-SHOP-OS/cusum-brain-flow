

## Make Chat Message Text Bolder and More Readable

### Problem
Message text in Team Hub chat uses `text-sm text-foreground/90` which appears thin and hard to read, especially on light background themes.

### Changes

**File**: `src/components/teamhub/MessageThread.tsx` (line 664)
- Change message text class from `text-sm text-foreground/90` to `text-sm font-medium text-foreground` — removes the 90% opacity and adds medium font weight for better readability
- Also update sender name class (line 600) from `font-semibold text-sm` to `font-bold text-sm` for stronger name visibility

| File | Change |
|---|---|
| `src/components/teamhub/MessageThread.tsx` | Make message text `font-medium text-foreground` (no opacity), sender names `font-bold` |

