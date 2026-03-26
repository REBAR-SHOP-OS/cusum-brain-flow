

# Fix Sidebar Display Issues in Editor

## Problem
The left sidebar panel (w-60 = 240px total, minus 48px icon strip = 192px content) is too narrow. The chapter cards' status badges ("completed") are truncated to "comp...", and the content feels cramped.

## Fix

### 1. Widen sidebar — `ProVideoEditor.tsx` (line 1036)
- Change `w-60` to `w-72` (288px total, giving ~240px for content area)

### 2. Fix badge truncation — `MediaTab.tsx` (line ~171)
- The status Badge at the end of each chapter row is truncated because the row uses `flex` with `truncate` on the title. Change the badge to show shorter text or ensure `shrink-0` + enough width.
- Use abbreviated status labels: "completed" → "done", "generating" → "gen…", "idle" → "idle"

### 3. Improve chapter card layout — `MediaTab.tsx`
- Give the thumbnail a slightly larger width (w-20 instead of w-16) so scenes are more recognizable
- Ensure the status badge doesn't overflow by keeping it compact

## Files Changed

| File | Change |
|---|---|
| `src/components/ad-director/ProVideoEditor.tsx` | Widen sidebar from `w-60` to `w-72` |
| `src/components/ad-director/editor/MediaTab.tsx` | Abbreviate status badges, slightly larger thumbnails |

