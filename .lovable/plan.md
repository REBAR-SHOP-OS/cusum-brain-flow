

# Add Brain (Memory) Icon to TimeClock Non-Kiosk View

## Problem
The Brain icon that opens the Face Memory Panel (showing enrolled photos for all people) is only visible in Kiosk mode. The user wants it also visible in the regular TimeClock view for `radin@rebar.shop`.

## Fix

**File:** `src/pages/TimeClock.tsx`

Add a Brain icon button next to the "9 photos enrolled" badge (around line 380-385), visible only for authorized users (`radin@rebar.shop`, `sattar@rebar.shop`, `neel@rebar.shop` — same list as kiosk mode). Clicking it opens the same `FaceMemoryPanel` dialog that already exists.

The `showMemoryPanel` state and `FaceMemoryPanel` component are already rendered inside the kiosk block. Move the `FaceMemoryPanel` render outside the kiosk conditional so it works in both views, and add a Brain button in the header/enrollment area.

### Changes
1. **Line ~377-386** — Add a Brain button next to the enrollment badges for authorized users
2. **Line ~285-287** — Move `FaceMemoryPanel` render from inside kiosk-only block to a shared location (e.g., right before the closing `</>` of the fragment)
3. No new components or state needed — `showMemoryPanel` state already exists

