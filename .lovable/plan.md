
# Fix: Screenshot Feedback Button Z-Index -- Stay On Top of All Layers

## Problem

The Screenshot Feedback button uses `z-50` (Tailwind's highest named z-index utility), but so do dialogs, drawers, popovers, toasts, and other overlays. The toast provider even uses `z-[100]`. This means the button can get buried under other UI elements.

## Fix (Single file, single class change)

### `src/components/feedback/ScreenshotFeedbackButton.tsx` (line 39)

Change the button's class from `z-50` to `z-[9999]` so it renders above every other layer in the app, including toasts (`z-[100]`), dialogs (`z-50`), and any future overlays.

**Before:**
```
className="fixed z-50 bottom-24 right-6 ..."
```

**After:**
```
className="fixed z-[9999] bottom-24 right-6 ..."
```

No other files touched. No new dependencies. No behavior changes.
