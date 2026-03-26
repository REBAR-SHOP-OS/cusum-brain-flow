

# Show Visual Preview on Draft Cards Instead of Icon

## Problem
All draft cards show a generic "Draft" document icon because their clips have `status: "idle"` with no `videoUrl`. There are no actual video frames to display for these drafts.

## Root Cause
The database confirms all recent draft clips are in `idle` status with null videoUrls — videos were never generated. The storyboard scenes exist with rich prompt descriptions but no thumbnail images.

## Solution
Since there are no video frames available for idle drafts, we'll extract a short visual description from the storyboard's first scene prompt and display it as a styled text preview on the card. This replaces the generic icon with meaningful context about each project.

Additionally, for any draft that DOES have a completed clip with a video URL, we'll ensure the video thumbnail works as intended.

## Changes

### `src/components/ad-director/VideoHistory.tsx`

1. **Add a `resolvePreviewText` helper** that extracts a short description from the first storyboard scene's `prompt` or `voiceover` field (first ~80 chars), falling back to the project name.

2. **Update the fallback UI** in `VideoCard`: instead of showing `<FileText>` icon + "Draft" text, show:
   - A styled text snippet from the storyboard prompt
   - Semi-transparent gradient overlay for readability
   - Keep the "Draft" badge in the corner

3. **Pass storyboard data** through `VideoCard` props (already available on `AdProjectRow`).

### Visual Result
```text
┌─────────────────────────┐
│ [Draft]  │
│                         │
│  "A slow, sweeping       │
│   drone shot over a      │
│   construction site..."  │
│                         │
├─────────────────────────┤
│ Rebar.Shop Ad    ✏️ 🗑️  │
│ Mar 26, 2026            │
└─────────────────────────┘
```

Instead of the current:
```text
┌─────────────────────────┐
│ [Draft]  │
│      📄                  │
│    Draft                 │
│                         │
├─────────────────────────┤
│ Untitled Ad        🗑️   │
│ Mar 26, 2026            │
└─────────────────────────┘
```

## Files Changed
- `src/components/ad-director/VideoHistory.tsx` — update fallback rendering for drafts without video URLs

