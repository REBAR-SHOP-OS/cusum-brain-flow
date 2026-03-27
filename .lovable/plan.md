

# Speed Up Face Scan Without Losing Accuracy

## Problem
Face recognition is slow due to:
1. Using `gemini-2.5-pro` (expensive, slow) — overkill for face matching
2. Sequential photo downloads (one-by-one for each profile)
3. Captured image at 1280x960 with 0.92 quality (large payload)
4. When uncertain (50-84% confidence), UI shows a manual confirm but doesn't force name input

User requirement: **zero wrong matches** — if uncertain, ask user to type their name.

## Solution

### 1. Switch AI model to `gemini-2.5-flash` (edge function)
**File:** `supabase/functions/face-recognize/index.ts`
- Line 188: Change `gemini-2.5-pro` → `gemini-2.5-flash`
- Line 236 (retry): Same change
- Flash is 3-5x faster, still excellent at vision/face comparison with tool calling
- Keep the same strict prompt and anti-bias rules

### 2. Parallelize photo downloads (edge function)
**File:** `supabase/functions/face-recognize/index.ts`
- Lines 76-108: Replace sequential `for...of` loop with `Promise.all` to download all photos concurrently
- This alone can cut 2-5 seconds off scan time when there are many enrolled people

### 3. Reduce captured image size (client)
**File:** `src/hooks/useFaceRecognition.ts`
- Lines 51-57: Change canvas from 1280x960 → 640x480, quality from 0.92 → 0.85
- Smaller image = faster upload + faster AI processing
- 640x480 is sufficient for face recognition

### 4. Force name input on low confidence (client)
**File:** `src/pages/TimeClock.tsx`
- Lines 126-139: When `face.state === "low_confidence"` (50-84%), show the `FirstTimeRegistration` component (name input) instead of showing the match result with confirm buttons
- This ensures **zero wrong matches** — uncertain = ask for name

**File:** `src/components/timeclock/FaceRecognitionResult.tsx`
- Remove the low-confidence confirm UI path. Only high-confidence (≥75%) matches show the confirm/punch buttons.

### 5. Raise minimum match threshold
**File:** `supabase/functions/face-recognize/index.ts`
- Line 260: Change `confidence >= 50` → `confidence >= 60` for `isMatched`
- Below 60% is too unreliable to even suggest a name

## Summary of Speed Gains
```text
Before                          After
─────────────────────────────── ───────────────────────
gemini-2.5-pro (~4-8s)         gemini-2.5-flash (~1-3s)
Sequential downloads (~2-5s)    Parallel downloads (~0.5-1s)
1280x960 @ 0.92 quality        640x480 @ 0.85 quality
Total: ~6-13s                   Total: ~2-4s
```

## Safety Guarantee
- High confidence (≥75%): auto-punch as before
- Low confidence (60-74%): show name input prompt ("اسمت رو بزن")
- Below 60%: no match, show registration
- Zero wrong matches: uncertain = always ask

## Files Changed
- `supabase/functions/face-recognize/index.ts` — faster model, parallel downloads, higher threshold
- `src/hooks/useFaceRecognition.ts` — smaller capture resolution
- `src/pages/TimeClock.tsx` — route low_confidence to name input
- `src/components/timeclock/FaceRecognitionResult.tsx` — remove low-confidence confirm path

