

## Make Floating Mic Button Bigger for Glove Use

### Change

**File: `src/components/feedback/FloatingMicButton.tsx`**

Increase the button from 56px to 72px and the icon from 28px to 36px for easier glove tapping on the shop floor.

- `BTN_SIZE`: 56 → 72
- Button classes: `w-14 h-14` → `w-[72px] h-[72px]`
- Icon classes: `w-7 h-7` → `w-9 h-9`
- Add thicker ring and larger shadow for better visibility

Single file, ~4 line changes.

