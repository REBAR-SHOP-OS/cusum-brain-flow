

## Make Mic & Send Buttons Glove-Friendly in Feedback Overlay

### Problem
The microphone button in the annotation overlay (`AnnotationOverlay.tsx`) is 56px (`w-14 h-14`) — too small for shop floor workers wearing gloves on tablets. The Send button is even smaller at default size.

### Changes

**File: `src/components/feedback/AnnotationOverlay.tsx`**

**1. Enlarge the Mic button**
- Change from `!w-14 !h-14` → `!w-20 !h-20` (80px — large enough for gloved hands)
- Increase icon size from `w-7 h-7` → `w-10 h-10`
- Add `rounded-2xl` for a bigger touch target feel

**2. Enlarge the Send button**
- Add explicit sizing: `!h-20 !px-6 text-base` to match the mic height
- Increase icon from `w-4 h-4` → `w-6 h-6`

**3. Increase textarea min-height**
- Bump `min-h-[60px]` → `min-h-[70px]` to align better with the taller buttons

The bottom bar will look like:

```text
┌──────────────────────────┐ ┌────────┐ ┌──────────┐
│  Describe the change...  │ │  🎤    │ │  ➤ Send  │
│                          │ │ (80px) │ │  (80px)  │
└──────────────────────────┘ └────────┘ └──────────┘
```

### What does NOT change
- Drawing canvas, color picker, undo/clear toolbar
- Voice recognition logic, send logic, screenshot capture
- No backend changes

