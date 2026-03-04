

# Fix Face Recognition Error + Add First-Time Enrollment Flow

## Problem
The Face ID Kiosk shows "Recognition Error" when scanning. The most likely cause is the Gemini OpenAI-compatible API failing on the `tool_choice` format or the multi-image request. Without edge function logs appearing, the error is being swallowed silently.

Additionally, the user wants: when a face is **not recognized** (first visit), prompt for the person's name, enroll their face, create their profile, and clock them in — so next time it's fully automatic.

## Plan

### 1. Fix Edge Function (`supabase/functions/face-recognize/index.ts`)

- **Add robust error logging** with `console.error` for every failure path so logs are visible
- **Handle Gemini tool_choice compatibility**: Change `toolChoice` from `{type: "function", function: {name: ...}}` to `"auto"` — Gemini's OpenAI-compat endpoint has inconsistent support for forced tool choice
- **Add fallback text parsing**: If no `toolCalls` returned, attempt to parse the AI's text response as JSON
- **Reduce image count**: Limit to 2 reference photos per person to stay within Gemini's token limits for multi-image requests
- **Return `no_match` with the captured image URL** when unrecognized, so the frontend can use it for enrollment

### 2. New "First-Time Registration" UI Flow (`src/components/timeclock/FirstTimeRegistration.tsx`)

When face scan returns `no_match` in kiosk mode:
- Show a form asking for the employee's **full name**
- On submit:
  1. Create a new `profiles` entry (linked to the kiosk user `ai@rebar.shop` as creator)
  2. Upload the captured frame to `face-enrollments` storage
  3. Create a `face_enrollments` record linking the photo to the new profile
  4. Auto clock-in the new employee
  5. Show success and reset to scan mode

### 3. Update Kiosk Flow (`src/pages/TimeClock.tsx`)

- When `face.state === "no_match"` in kiosk mode, show `FirstTimeRegistration` component instead of the generic error
- Pass `captureFrame` function so the component can grab the current frame for enrollment
- After registration completes, auto-clock-in and reset

### 4. Update Hook (`src/hooks/useFaceRecognition.ts`)

- Better error handling: show the actual server error message in the toast instead of generic "Recognition failed"

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/face-recognize/index.ts` | Fix tool_choice, add fallback parsing, better logging |
| `src/components/timeclock/FirstTimeRegistration.tsx` | New component: name input + auto-enroll + clock-in |
| `src/pages/TimeClock.tsx` | Show FirstTimeRegistration on no_match in kiosk mode |
| `src/hooks/useFaceRecognition.ts` | Better error message display |

