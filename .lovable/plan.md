
# Fix: Station Title Text Truncation in Shop Floor Header

## Root Cause

File: `src/components/shopfloor/StationHeader.tsx`

Two CSS issues on adjacent elements cause the truncation:

**Issue 1 — `<header>` line 52:**
The header uses `items-center`, which vertically centres all flex children. When text wraps and the left column grows taller, `items-center` fights against it and may clip. It should be changed to `items-start` so the header grows naturally with the wrapped title.

**Issue 2 — `<h1>` line 59:**
Inside a flex row, text is not free to wrap by default — it tries to stay on one line and gets squeezed/truncated. The `<h1>` needs `whitespace-normal break-words` (or simply `whitespace-normal`) to allow it to wrap onto multiple lines. Adding `min-w-0` to the parent `<div>` on line 54 is also required so the flex child can shrink and let the text wrap rather than overflow.

## Exact Changes — `src/components/shopfloor/StationHeader.tsx` Only

### Change 1: `<header>` — swap `items-center` → `items-start` (line 52)

```diff
- <header className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
+ <header className="flex items-start justify-between px-4 py-3 bg-card border-b border-border">
```

This allows the header's height to expand naturally when the title wraps, without clipping.

### Change 2: Left flex child `<div>` — add `min-w-0` (line 54)

```diff
- <div className="flex items-center gap-3">
+ <div className="flex items-center gap-3 min-w-0">
```

`min-w-0` overrides the default `min-width: auto` on flex children, allowing this column to shrink so the title text can wrap instead of overflowing.

### Change 3: `<h1>` — add `whitespace-normal break-words` (line 59)

```diff
- <h1 className="font-bold text-base sm:text-lg uppercase tracking-wide text-foreground">
+ <h1 className="font-bold text-base sm:text-lg uppercase tracking-wide text-foreground whitespace-normal break-words">
```

This explicitly permits the title text to wrap onto multiple lines. The title "CIRCULAR SPIRAL BENDER 10M-20M BEDS" will now break naturally at word boundaries.

---

## Scope

| File | Lines Changed | Nature |
|---|---|---|
| `src/components/shopfloor/StationHeader.tsx` | 52, 54, 59 | CSS class additions only |

## What Is NOT Changed

- The Supervisor button — untouched
- The Pool button — untouched
- The REMAINING badge — untouched
- The Workspace chip — untouched
- The Mark/Drawing centre section — untouched
- `src/pages/StationView.tsx` — untouched
- All other shop floor components, pages, database logic — untouched
