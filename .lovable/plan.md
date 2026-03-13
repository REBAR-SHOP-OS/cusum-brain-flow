

# Cache Recognized Faces + Improve Scan Accuracy

## Problem
1. After a person is recognized and confirms their identity, the kiosk still asks for confirmation on subsequent scans (especially for users with ≤2 enrollments).
2. Scan accuracy could be improved.

## Solution

### 1. Client-side face cache (`TimeClock.tsx`)
- Add a `confirmedProfilesRef = useRef<Set<string>>()` that stores profile IDs of people who have already been confirmed in this kiosk session.
- After a successful `handleConfirmPunch`, add the `profileId` to this set.
- In `handleScan`, after `face.recognize()` returns a result: if the matched `profile_id` is already in the confirmed set, **skip confirmation entirely** and auto-punch immediately (1s countdown) regardless of enrollment count or confidence (as long as confidence >= 75).
- This means: first scan may ask "Are you X?", but every subsequent scan of the same person just auto-punches.

### 2. Improve scan accuracy (`face-recognize/index.ts`)
- Increase reference photos per person from 4 to 5 (line 68).
- Add instruction to AI prompt emphasizing to compare **glasses, facial hair, face shape** more carefully.
- Add a "focus on the face closest to camera center" instruction to reduce false matches from background people.

### Files
- `src/pages/TimeClock.tsx` — add `confirmedProfilesRef`, update `handleScan` and `handleConfirmPunch`
- `supabase/functions/face-recognize/index.ts` — bump photo limit to 5, refine prompt for accuracy

