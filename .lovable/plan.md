

# Allow Click-to-Skip on AI Video Director Intro Video

## Problem
When the AI Video Director intro video plays (full-screen), the user cannot skip it — they must wait for it to end. The user wants to click anywhere on the screen to dismiss/skip the video.

## Change

### File: `src/components/ad-director/AdDirectorContent.tsx` (lines 416-425)

Add an `onClick` handler to the intro video container div to skip the video:

```tsx
<div 
  className="fixed inset-0 z-50 bg-black flex items-center justify-center cursor-pointer"
  onClick={() => setShowIntro(false)}
>
  <video ... />
</div>
```

This is a single-line change — add `onClick={() => setShowIntro(false)}` and `cursor-pointer` to the existing wrapper div at line 416.

## Files Changed
- `src/components/ad-director/AdDirectorContent.tsx` — add click-to-skip on intro video overlay

