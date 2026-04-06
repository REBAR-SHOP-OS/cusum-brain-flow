

# Speed Up Face Recognition for AI@REBAR.SHOP Kiosk

## Problem
Face scanning is slow because every scan: downloads up to 3 photos per enrolled person from storage, converts all to base64, sends all images to AI, and retries on failure. This adds up to several seconds.

## Optimizations

### 1. Edge Function: `supabase/functions/face-recognize/index.ts`

**a) Use faster AI model**
- Switch from `gemini-2.5-flash` to `gemini-2.5-flash-lite` (fastest model, ideal for classification tasks like face matching)

**b) Reduce photos per person: 3 → 1**
- Line 56: change `if (urls.length < 3)` → `if (urls.length < 1)`
- Fewer images = less download time + less AI processing time

**c) Remove retry logic**
- Lines 243-262: Remove the "retry once if no structured result" block
- Saves an entire duplicate AI call on edge cases

**d) Reduce prompt verbosity**
- Shorten the system prompt (lines 134-159) — remove redundant anti-bias rules that inflate token count and slow processing

### 2. Client: `src/hooks/useFaceRecognition.ts`

**a) Reduce captured image size**
- Line 51-52: Change canvas from 640×480 → 480×360
- Line 53: Reduce JPEG quality from 0.85 → 0.7
- Smaller payload = faster upload + faster AI processing

### 3. Client: `src/pages/TimeClock.tsx`

**a) For ai@rebar.shop: auto-trigger scan on camera ready**
- After camera starts in kiosk mode, auto-click "Scan Face" after 1s delay so the operator doesn't need to tap

## Expected Impact
- Model switch: ~40-50% faster AI response
- 1 photo vs 3: ~60% less download + smaller AI payload
- Smaller capture: ~30% less upload time
- No retry: eliminates worst-case double latency
- Auto-scan: removes manual tap delay

## Files Changed
- `supabase/functions/face-recognize/index.ts`
- `src/hooks/useFaceRecognition.ts`
- `src/pages/TimeClock.tsx`

