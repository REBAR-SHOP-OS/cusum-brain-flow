

# Black Background for Result/Storyboard View

## Problem
In the "result" state (where generated scenes and video preview are shown), the video background bleeds through, creating visual clutter. The user wants a solid black background in this section.

## Change

### `src/components/ad-director/AdDirectorContent.tsx` — Line 422-423

Wrap the result section with a full-screen black background overlay so the video background is hidden when viewing results.

Change line 422-423 from:
```tsx
{flowState === "result" && (
  <div className="w-full max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
```
To:
```tsx
{flowState === "result" && (
  <>
    <div className="fixed inset-0 z-[5] bg-black" />
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
```

And close the fragment at the end of the result block (after the closing `</div>` and before the `)}` on the result section end).

| File | Change |
|---|---|
| `AdDirectorContent.tsx` | Add fixed black overlay behind result view, close fragment |

