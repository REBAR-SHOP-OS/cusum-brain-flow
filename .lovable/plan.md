

# Fix: Face Recognition Accuracy & "Ask First" Flow

## Problem
The AI vision model is returning **false positive matches** (e.g., showing "Sattar Esmaeili" at 90% for the wrong person). The user wants:
1. **First scan of unknown face** → Ask "What is your name?" → Enroll the face
2. **Subsequent scans** → Show the correct name automatically
3. **Never show a wrong name**

## Root Causes
1. **AI prompt is too lenient**: Says "Be TOLERANT" and "assign confidence 70+" for similar faces → false positives
2. **Backend threshold too low**: Accepts matches at confidence ≥ 40
3. **Multiple faces in frame**: The screenshot shows 2 people; the AI picks one randomly
4. **No verification step**: System trusts AI match blindly without asking user to confirm identity on first encounter

## Solution

### 1. Rewrite `face-recognize` AI Prompt (Stricter)
- Remove "Be TOLERANT" instruction
- Add: "Only match if you are CERTAIN it's the same person. If in doubt, return no match."
- Add: "If multiple faces are visible, focus on the most prominent/centered face"
- Raise backend match threshold from **40 → 75**
- Add instruction: "Pay close attention to unique facial features: nose shape, eye distance, jawline, facial hair"

### 2. Add Confidence Verification in Kiosk UI
- For **first-time matches** (profile has ≤ 2 enrollments), show confirmation: "Are you [Name]? Yes / No, I'm new"
- If user says "No" → show FirstTimeRegistration flow
- If user says "Yes" → proceed with punch + auto-enroll additional photo
- For **well-enrolled profiles** (3+ enrollments with prior confirmed punches), auto-punch as before

### 3. Update `kiosk-punch` to Track Confirmation Count
- Add a simple check: if profile has < 3 enrollments, the frontend forces a name confirmation step before punching

### Files to Edit

| File | Change |
|---|---|
| `supabase/functions/face-recognize/index.ts` | Stricter prompt, raise threshold to 75, handle multiple faces |
| `src/pages/TimeClock.tsx` | Add confirmation step for low-enrollment profiles before auto-punch |
| `src/components/timeclock/FaceRecognitionResult.tsx` | Add "That's not me" button that triggers registration flow |

