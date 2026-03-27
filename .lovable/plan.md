

# Fix: Auto-Enrollment Saves Wrong Person's Photo Under Matched Profile

## Root Cause

In `kiosk-punch/index.ts` (lines 65-89), there is an **auto-enroll** feature: every time someone punches in/out, their current face photo is automatically saved under the **matched profile's** enrollment folder.

**The problem:** If the AI misidentifies Zahra as Radin (even once), Zahra's photo gets saved under Radin's `face_enrollments`. This:
1. Pollutes Radin's enrollment data with Zahra's face
2. Makes future recognition worse (Radin's folder now contains Zahra's photos)
3. Creates a cascading error — more wrong matches in the future

## Solution: Remove Auto-Enrollment From Punch

**Completely disable auto-enrollment in `kiosk-punch`.** Enrollment should ONLY happen through the Face Memory panel where an admin manually controls whose photos are saved.

### Changes

**File: `supabase/functions/kiosk-punch/index.ts`**
- Remove lines 65-89 (the entire auto-enroll block)
- Remove `faceBase64` from the destructured body (line 6) since it's no longer needed

**File: `src/pages/TimeClock.tsx`**
- Line 162: Stop capturing `faceBase64` in `handleConfirmPunch` — no longer sent to the edge function
- Change `body: { profileId, faceBase64 }` → `body: { profileId }`

### Cleanup: Delete Zahra's Misplaced Photo
- The wrongly-enrolled photo under Radin's profile (visible in the screenshot with red circle) should be manually deleted via the Face Memory panel's delete button.

## Why This Is the Right Fix
Auto-enrollment is inherently dangerous: a single misidentification poisons the training data. Manual enrollment via the Face Memory panel (controlled by admins) is the only safe path.

## Files Changed
- `supabase/functions/kiosk-punch/index.ts` — remove auto-enroll block
- `src/pages/TimeClock.tsx` — stop sending `faceBase64` to kiosk-punch

