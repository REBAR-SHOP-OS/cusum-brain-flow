

# Fix Home Button — Skip Intro Video

## Problem
Clicking the purple Home button resets `flowState` to `"idle"`, but `showIntro` remains `true`, so the intro video plays again before showing the form.

## Change

| File | Change |
|---|---|
| `src/components/ad-director/AdDirectorContent.tsx` (line 471) | In the Home button `onClick`, also set `setShowIntro(false)` so it goes directly to the form without the intro video |

```tsx
onClick={() => {
  setShowIntro(false);
  service.patchState({ flowState: "idle" });
}}
```

