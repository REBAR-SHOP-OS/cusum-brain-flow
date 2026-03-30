

# Fix Audio Track Dragging on Timeline

## Problem
Audio tracks are created with fake `sceneId` values (`"generated"`, `"uploaded"`, `"upload-${Date.now()}"`, `""`) that don't match any storyboard scene. In `TimelineBar.tsx` line 800, `if (idx < 0) return null;` silently skips rendering these tracks. For tracks that DO render (voiceover tracks with real sceneIds), the drag mechanism already works but needs the same treatment as text overlays.

## Root Cause
Audio track creation in `ProVideoEditor.tsx` uses placeholder sceneIds instead of actual storyboard scene IDs.

## Fix

### 1. `src/components/ad-director/ProVideoEditor.tsx` — Assign real sceneIds when creating audio tracks

Update all `setAudioTracks` calls that use fake sceneIds to use the first storyboard scene's ID instead:
- Line 302: `sceneId: "generated"` → `sceneId: storyboard[0]?.id || ""`
- Line 322: `sceneId: "uploaded"` → `sceneId: storyboard[0]?.id || ""`  
- Line 353: `sceneId: "voiceover-generated"` → `sceneId: storyboard[0]?.id || ""`
- Line 359: `sceneId: ""` → `sceneId: storyboard[0]?.id || ""`
- Line 485: `sceneId: \`upload-${Date.now()}\`` → `sceneId: storyboard[0]?.id || ""`

Also set `startTime: 0` on these tracks so they position correctly.

### 2. `src/components/ad-director/editor/TimelineBar.tsx` — Fallback for unmatched sceneIds

Instead of `return null` when `idx < 0`, fall back to rendering the audio bar spanning the full timeline (left=0%, width=100%). This ensures backward compatibility for any tracks with old/invalid sceneIds. These full-span tracks should still be draggable to reposition them to a specific scene+time.

## Files Changed
- `src/components/ad-director/ProVideoEditor.tsx` — fix sceneId assignments  
- `src/components/ad-director/editor/TimelineBar.tsx` — add fallback rendering for unmatched audio sceneIds

