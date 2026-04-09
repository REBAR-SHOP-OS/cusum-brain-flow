

# Improve Face Recognition Accuracy

## Problem
The Face ID Kiosk uses a weak AI model and only sends 1 reference photo per person (despite having 3 enrolled). The camera capture resolution is also low. These factors reduce matching accuracy.

## Root Causes Found

1. **Only 1 photo per person sent to AI** — Line 56 in `face-recognize/index.ts`: `if (urls.length < 1)` limits to 1 reference photo, wasting the other 2-3 enrolled photos
2. **Weakest AI model** — Using `gemini-2.5-flash-lite` (line 186), the cheapest/fastest but least accurate vision model
3. **Low capture resolution** — Camera captures at 480x360 (in `useFaceRecognition.ts` line 53-54), losing facial detail

## Changes

### 1. Send all enrolled photos to AI (`supabase/functions/face-recognize/index.ts`)
- Change `urls.length < 1` → `urls.length < 3` to send up to 3 reference photos per person
- More reference angles = much better matching accuracy

### 2. Upgrade AI model
- Change `gemini-2.5-flash-lite` → `gemini-2.5-flash` for stronger vision capability
- Still fast (~2-3s) but significantly better at facial comparison

### 3. Increase capture resolution (`src/hooks/useFaceRecognition.ts`)
- Change canvas capture from 480x360 → 640x480
- Better facial detail for the AI to analyze

### 4. Improve prompt precision
- Add instruction to compare each enrolled person's multiple photos for consistency
- Emphasize that lighting/angle variations should be accounted for

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/face-recognize/index.ts` | Send 3 photos per person, upgrade to gemini-2.5-flash, refine prompt |
| `src/hooks/useFaceRecognition.ts` | Increase capture resolution to 640x480 |

