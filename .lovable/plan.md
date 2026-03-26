

# Fullscreen Always-On Intro Video

## Changes

### `src/components/ad-director/AdDirectorContent.tsx`

1. **Always show intro**: Change `useState` init from sessionStorage check to just `true` — always start with intro visible
2. **Remove sessionStorage**: Remove all `sessionStorage.getItem/setItem("ad-director-intro-seen")` references
3. **Remove Skip button**: Delete the `<Button>` overlay (lines 384-394)
4. **Fullscreen video**: Replace the `max-w-2xl` container with a fixed fullscreen overlay (`fixed inset-0 z-50 bg-black flex items-center justify-center`) so the video covers the entire page
5. **On video end**: Simply set `showIntro(false)` — no sessionStorage, so it will show again on next mount/visit

### Summary of behavior
- Every time user enters Ad Director → fullscreen video plays
- No skip button — must watch until end
- Video covers entire screen with black background
- After video ends → normal idle UI appears

| File | Change |
|---|---|
| `AdDirectorContent.tsx` | Fullscreen container, remove skip button, remove sessionStorage, always init `showIntro = true` |

