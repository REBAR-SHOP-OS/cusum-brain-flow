

# Fix: AI Agent Images Cropped on iOS

## Problem

Agent helper images are cropped on iOS mobile devices because they use `object-cover`, which fills the container by cropping excess content. On smaller iOS screens with different aspect ratios, this cuts off important parts of the character images (heads, faces).

## Affected Files and Locations

There are **3 files** with agent image rendering that need fixes:

### 1. Home Page Helper Cards (`src/pages/Home.tsx`, line 233)

**Current:** `object-cover object-top` inside a fixed `aspect-square` container
**Problem:** On small mobile screens (4-column grid), the square container is tiny and `object-cover` aggressively crops the character images.

**Fix:**
- Change `object-cover object-top` to `object-contain` so the full character is always visible
- Add a subtle background color so the `contain` fit looks clean (no awkward whitespace)

### 2. Agent Sidebar Header (`src/components/agent/AgentHistorySidebar.tsx`, line 50-55)

**Current:** `aspect-[4/3]` container with `object-cover object-top`
**Problem:** On iOS the 4:3 crop cuts off character images depending on the original aspect ratio.

**Fix:**
- Change to `object-contain` with a muted background fill
- Keep the `aspect-[4/3]` container for consistent layout

### 3. Agent Suggestion Avatars (`src/components/agent/AgentSuggestions.tsx`, line 27)

**Current:** `object-cover` on small `w-4 h-4` / `w-5 h-5` rounded avatars
**Problem:** Minor cropping on tiny circular avatars. Less critical but should be consistent.

**Fix:**
- Keep `object-cover` here -- for small circular avatars, `cover` is correct (it fills the circle). No change needed.

## Technical Changes

| File | Line | Before | After |
|------|------|--------|-------|
| `src/pages/Home.tsx` | 232-233 | `aspect-square overflow-hidden bg-muted` + `object-cover object-top` | `aspect-square overflow-hidden bg-muted/50` + `object-contain object-top` |
| `src/components/agent/AgentHistorySidebar.tsx` | 50-55 | `aspect-[4/3] overflow-hidden` + `object-cover object-top` | `aspect-[4/3] overflow-hidden bg-muted/30` + `object-contain object-top` |

## Why `object-contain` Fixes iOS

- `object-cover`: scales image to **fill** container, cropping overflow. On small iOS screens, this crops aggressively.
- `object-contain`: scales image to **fit** inside container, showing the entire image. No cropping. The background color fills any remaining space.

## What Does NOT Change

- No database or schema changes
- No dependency changes
- No backend/edge function changes
- Agent suggestion small avatars stay as `object-cover` (correct for circular thumbnails)
- Desktop layout is unaffected (images just fit better)
