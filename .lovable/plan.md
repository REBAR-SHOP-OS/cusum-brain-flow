

## Plan: Fix Horizontal Scroll in AI Extract Table

### Root Cause
Line 1027 in `AIExtractView.tsx` has `overflow-x-hidden` on the outer content wrapper, which blocks all horizontal scrolling — even though the table container at line 2237 correctly has `overflow-auto` and the inner table has `min-w-[1400px]`.

### Fix — Single Line Change

**File: `src/components/office/AIExtractView.tsx`** — Line 1027

Change:
```
overflow-x-hidden
```
To:
```
overflow-x-auto
```

This allows the wide table (and any other wide content) to scroll horizontally when it exceeds the viewport width.

### What does NOT change
- Table structure, sticky headers, vertical scroll, or any other layout behavior.

