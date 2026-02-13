

# Audit and Improve "Remaining" Display -- Make It Big and Foolproof

## Current Issues Found

1. **"47 REMAINING" badge is tiny** -- it's a small `text-xs` outline badge in the header, easy to miss
2. **Hidden on mobile** -- uses `hidden sm:flex`, so operators on tablets in portrait mode can't see it at all
3. **No color urgency** -- same muted outline regardless of whether 47 or 2 items remain
4. **Only counts incomplete items** -- `items.filter(i => i.completed_pieces < i.total_pieces).length` which is correct, but it's not shown prominently enough for operators to track progress

## Plan

### 1. Make "Remaining" Always Visible in Header (StationHeader.tsx)

- Remove `hidden sm:flex` so it shows on all screen sizes
- Increase badge size and make it visually dominant with color coding:
  - Green pulse when remaining is less than or equal to 3 (almost done)
  - Amber/warning when less than or equal to 10
  - Default primary otherwise
- Use a larger font size (`text-sm font-bold`) instead of `text-xs`

### 2. Add a Prominent Remaining Banner Below Header (CutterStationView.tsx)

Add a full-width progress strip between the header and the content area showing:
- Large remaining count with progress bar
- "X of Y marks complete" text
- Color transitions as work progresses (green zone near completion)

### 3. Show Remaining in Operator Stats Cards (CutterStationView.tsx)

Replace or augment the existing stats grid to include a dedicated "Remaining Marks" card that's visually distinct (larger, colored border) so the operator always sees it at a glance.

## Technical Details

### File: `src/components/shopfloor/StationHeader.tsx`

**Line 91** -- Remove `hidden sm:flex` from the remaining badge, increase size, add dynamic color:

```tsx
{remainingCount !== undefined && (
  <Badge 
    className={cn(
      "font-mono text-sm font-bold px-3 py-1.5",
      remainingCount <= 3 
        ? "bg-green-500/20 text-green-400 border-green-500/40 animate-pulse" 
        : remainingCount <= 10 
          ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
          : "border-primary/40 text-primary"
    )}
    variant="outline"
  >
    {remainingCount} REMAINING
  </Badge>
)}
```

### File: `src/components/shopfloor/CutterStationView.tsx`

**After the StationHeader (line ~400)** -- Add a progress strip:

```tsx
{/* Remaining progress strip */}
<div className={cn(
  "flex items-center justify-between px-6 py-2 border-b border-border",
  remaining <= 3 ? "bg-green-500/10" : remaining <= 10 ? "bg-amber-500/10" : "bg-muted/30"
)}>
  <div className="flex items-center gap-3">
    <span className={cn(
      "text-2xl font-black font-mono",
      remaining <= 3 ? "text-green-500" : remaining <= 10 ? "text-amber-500" : "text-foreground"
    )}>
      {remaining}
    </span>
    <span className="text-xs text-muted-foreground uppercase tracking-wider">
      marks remaining of {items.length}
    </span>
  </div>
  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
    <div 
      className={cn(
        "h-full rounded-full transition-all",
        remaining <= 3 ? "bg-green-500" : remaining <= 10 ? "bg-amber-500" : "bg-primary"
      )}
      style={{ width: `${((items.length - remaining) / items.length) * 100}%` }}
    />
  </div>
</div>
```

### File: `src/components/shopfloor/BenderStationView.tsx`

Apply the same progress strip pattern for consistency on the bender station.

### Files Modified
- `src/components/shopfloor/StationHeader.tsx` -- bigger, always-visible, color-coded remaining badge
- `src/components/shopfloor/CutterStationView.tsx` -- progress strip below header
- `src/components/shopfloor/BenderStationView.tsx` -- same progress strip for consistency
