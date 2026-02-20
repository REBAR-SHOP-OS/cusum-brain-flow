
# Fix: Remove Floating Microphone Button from Shop Floor Hub

## Root Cause

In `src/pages/ShopFloor.tsx`, the `VoiceRecorderWidget` component is imported and rendered unconditionally at the bottom of the page:

```tsx
import { VoiceRecorderWidget } from "@/components/shopfloor/VoiceRecorderWidget";
// ...
{/* Voice Recorder Widget */}
<VoiceRecorderWidget />
```

This widget renders a fixed-position (`fixed bottom-6 right-6`) microphone button that floats over the entire page — exactly what is shown in the screenshot.

## Fix

Two surgical changes to `src/pages/ShopFloor.tsx`:

1. **Remove the import** of `VoiceRecorderWidget` from the top of the file.
2. **Remove the `<VoiceRecorderWidget />` JSX** at the bottom of the return statement.

The `VoiceRecorderWidget` component itself (`src/components/shopfloor/VoiceRecorderWidget.tsx`) is left untouched — it may be used on other shopfloor sub-pages.

## Files Modified

- `src/pages/ShopFloor.tsx` — remove import and JSX instance of `VoiceRecorderWidget`
