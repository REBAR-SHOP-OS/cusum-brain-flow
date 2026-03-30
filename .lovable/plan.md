

# Finer Timeline Ruler Granularity

## Problem
The timeline ruler currently shows ticks every 1 second with labels every 2 seconds. The user wants finer granularity to enable more precise dragging and positioning of the playhead and items.

## Change

### File: `src/components/ad-director/editor/TimelineBar.tsx` (lines 530-542)

Replace the current ruler tick generation with half-second (0.5s) intervals:

- Generate ticks at every 0.5s instead of every 1s
- Major ticks (tall + labeled) at every 1s instead of every 2s
- Minor ticks (short, no label) at every 0.5s between major ticks
- This doubles the precision for visual alignment

```tsx
{Array.from({ length: Math.ceil(totalDuration * 2) + 1 }, (_, i) => {
  const sec = i * 0.5;
  const leftPct = (sec / totalDuration) * 100;
  if (leftPct > 100) return null;
  const isMajor = sec % 1 === 0; // every full second is major
  return (
    <div key={i} className="absolute top-0 bottom-0" style={{ left: `${leftPct}%` }}>
      <div className={`absolute bottom-0 w-px ${isMajor ? 'h-3 bg-muted-foreground/50' : 'h-1.5 bg-muted-foreground/25'}`} />
      {isMajor && (
        <span className="absolute bottom-3.5 text-[7px] text-muted-foreground font-mono -translate-x-1/2 select-none">{sec}s</span>
      )}
    </div>
  );
})}
```

## Files Changed
- `src/components/ad-director/editor/TimelineBar.tsx` — finer 0.5s ruler ticks

