

# Remove Auto-Enrollment from Kiosk Registration

## Problem
The `kiosk-register` edge function (lines 49-73) still saves face photos to `face_enrollments` when a new person registers at the kiosk. Per your directive: **the kiosk's job is ONLY identification. All enrollment must happen through the Face Memory panel.**

The previous fix removed auto-enrollment from `kiosk-punch`, but `kiosk-register` still has it.

## Changes

### 1. `supabase/functions/kiosk-register/index.ts`
- Remove lines 49-73 (the entire face photo upload + enrollment block)
- Keep `faceBase64` in the destructured body — it's harmless but unused; OR remove it for cleanliness
- The function will only: create/find profile → clock in → return

### 2. `src/components/timeclock/FirstTimeRegistration.tsx`
- Line 64: Remove `const faceBase64 = captureFrame();`
- Line 66: Change `body: { name: trimmedName, faceBase64 }` → `body: { name: trimmedName }`
- Line 84: Remove `const faceBase64 = captureFrame();`
- Line 86: Change `body: { name: candidate.full_name, faceBase64, existingProfileId: candidate.id }` → `body: { name: candidate.full_name, existingProfileId: candidate.id }`

## Result
- Kiosk scan = identification only (no writes to face_enrollments)
- Face Memory panel = the single source of truth for enrollment photos
- Zero risk of wrong photos contaminating enrollment data

