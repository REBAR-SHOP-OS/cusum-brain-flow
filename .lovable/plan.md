

# Auto-Enroll Face Photos During Kiosk Clock-In/Clock-Out

## What This Does
When an employee successfully punches (clock in or clock out) via the Kiosk's Face ID, the system will automatically save the captured frame as an enrollment photo for that employee — but only if they have fewer than 3 enrolled photos. This builds up the face database passively over time without requiring a separate enrollment step.

## How It Works

### 1. Capture frame on successful punch (`src/pages/TimeClock.tsx`)
In `handleConfirmPunch`, after a successful clock-in or clock-out, if the employee has fewer than 3 face enrollments:
- Capture the current video frame using `face.captureFrame()` (already exposed by `useFaceRecognition`)
- Upload the JPEG to `face-enrollments` storage bucket under the employee's user ID path
- Insert a row into `face_enrollments` table linking the photo to the employee's profile

### 2. Expose `captureFrame` from the hook
The `useFaceRecognition` hook already has `captureFrame` as an internal function. It just needs to be added to the return object so `TimeClock.tsx` can call it.

### 3. Look up enrollment count per profile
Before auto-enrolling, query `face_enrollments` count for the matched profile to avoid exceeding 3 photos. This is a quick count query.

### 4. Look up the employee's `user_id` for storage path
The storage bucket organizes photos by `user_id` (from `auth.users`). The matched result gives us `profile_id`, so we need to look up the corresponding `user_id` from the `profiles` table.

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useFaceRecognition.ts` | Add `captureFrame` to the returned object |
| `src/pages/TimeClock.tsx` | In `handleConfirmPunch`, after successful punch in kiosk mode, auto-enroll the captured frame if enrollment count < 3 |

## No Database or Edge Function Changes
The `face_enrollments` table and `face-enrollments` storage bucket already exist. RLS allows inserts from authenticated users.

