

# Fix: Playhead Always Visible Above Video Track & Starts at Zero

## Problem
1. The playhead (red indicator line) can render behind the video track scenes because scene elements have `z-10` (selected) and `z-20` (resize handles), while the playhead wrapper is `z-40` but the video track content with `overflow-hidden` and stacking context can obscure it.
2. The playhead should always initialize at position 0 (start of video).

## Solution (1 file)

### `src/components/ad-director/editor/TimelineBar.tsx`

**1. Increase playhead z-index to `z-50`** (line ~678) so it always renders above all track content including selected scenes (`z-10`) and resize handles (`z-20`).

**2. Move the playhead div AFTER the track rows** in the DOM order — currently it's placed before the video track inside the wrapper div. Move it to after all track rows (video, text, audio) but still inside the relative wrapper. This ensures correct stacking even without z-index differences.

**3. Ensure `globalTime` starts at 0** — verify that `playheadPct` calculation (line 393) correctly produces 0% when `globalTime` is 0. This is already correct (`globalTime / totalDuration * 100 = 0`), but we should also ensure the rAF update (line 200-207) doesn't override with stale values on mount.

## Changes

### File: `src/components/ad-director/editor/TimelineBar.tsx`

**Move playhead div**: Cut lines 675-693 (the Global Playhead block) and paste it just before the closing `</div>` of the "All Track Rows Wrapper" (before line 979). This places it after video, text, and audio rows in DOM order.

**Update z-index**: Change `z-40` to `z-50` on the playhead div class (line 678).

```tsx
{/* ─── Global Playhead (spans all rows) ─── */}
<div
  ref={playheadRef}
  className={`absolute top-0 bottom-0 z-50 ${scrubbing ? 'cursor-grabbing' : 'cursor-grab'} pointer-events-auto`}
  style={{ left: `${playheadPct}%`, width: '16px', transform: 'translateX(-7px)', willChange: 'left' }}
  ...
>
```

## Result
- Playhead always renders on top of all track elements (video, text, audio)
- Playhead starts at position 0 (beginning of video timeline)
- No visual obstruction from scene cards, thumbnails, or resize handles

