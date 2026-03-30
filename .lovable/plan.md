

# Fix Playhead Starting Position — Align to Zero Point

## Problem
The playhead (red marker) in the timeline is positioned as a percentage of the full wrapper div, which includes the `w-14` (56px) label column ("Video", "Text", "Audio", "Music"). This means `left: 0%` places the playhead over the labels instead of at the actual zero point of the tracks. The video preview itself starts at `currentTime = 0` correctly, but the visual playhead is misaligned.

## Root Cause
In `TimelineBar.tsx`, the global playhead (line ~1079) is an `absolute` element inside the wrapper div (line 709). This wrapper contains both the label columns (`w-14`) and the track content. Since the playhead uses `left: X%` positioning relative to this wrapper, it doesn't account for the label offset.

## Solution
Restructure the playhead container so it only covers the track area (excluding labels). This aligns the playhead's `0%` position with the actual start of the timeline tracks.

### `src/components/ad-director/editor/TimelineBar.tsx`

**Change 1 — Restructure the "All Track Rows Wrapper":**
- Wrap all track rows in a flex container with the same `w-14 + gap-0.5` label spacer on the left
- Place the playhead inside a new `relative flex-1` container that only covers the track area
- This way `left: 0%` = start of tracks, `left: 100%` = end of tracks

**Change 2 — Update rAF playhead positioning (line ~210):**
- No change needed — the percentage calculation is correct (`globalTime / totalDuration * 100`), just the container is wrong

**Change 3 — Ensure scrub handler uses trackRef correctly:**
- The scrub mouse handler already uses `trackRef` for position calculation, which is correct

### Structure (before → after):
```text
BEFORE:
  <div class="relative">          ← playhead parent (full width incl labels)
    <div class="flex">
      <label w-14/>               ← 56px label
      <div ref={trackRef}/>       ← actual track
    </div>
    <playhead left={pct}% />      ← misaligned (0% = over label)
  </div>

AFTER:
  <div class="flex gap-0.5">
    <span class="w-14"/>          ← spacer matching labels
    <div class="relative flex-1"> ← playhead parent (track width only)
      ... all track rows (without their own labels) ...
      <playhead left={pct}% />    ← aligned (0% = track start)
    </div>
  </div>
```

Since restructuring all track rows to separate labels from content is complex, the simpler approach:

**Simpler approach — Offset the playhead with CSS:**
- Add `left` and `right` insets to constrain the playhead within the track area
- Or wrap playhead in an absolute-positioned div that starts after the label column using `left: calc(56px + 2px)` and `right: 0`

**Simplest approach — Move playhead inside a dedicated overlay div:**
- Create an absolute overlay div inside the wrapper that has `left: 3.5rem` (matching `w-14`) and `right: 0`
- Place the playhead inside this overlay div
- Playhead `left: 0%` now aligns with track start

## Files Changed
- `src/components/ad-director/editor/TimelineBar.tsx` — fix playhead container to exclude label column width

## Result
The playhead starts exactly at the zero point of the timeline tracks, perfectly aligned with the ruler and video content.

