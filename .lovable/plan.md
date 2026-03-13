

# Fix Inconsistent Face Recognition in Kiosk

## Root Causes Identified

1. **Low capture quality**: JPEG quality 0.7 and 640x480 resolution lose facial detail
2. **Too few reference photos**: Only 2 enrollment photos per person sent to AI — insufficient for varied angles/lighting
3. **Weaker AI model**: `gemini-2.5-flash` is fast but less accurate for vision tasks
4. **Camera resolution**: Requested only 640x480 from getUserMedia
5. **toolChoice: "auto"**: AI sometimes returns text instead of structured tool call, causing parse failures

## Changes

### 1. `src/hooks/useFaceRecognition.ts` — Higher quality capture

- Increase camera resolution request: `width: { ideal: 1280 }, height: { ideal: 960 }`
- Increase canvas capture size to 1280x960
- Increase JPEG quality from 0.7 to 0.92 for sharper facial detail

### 2. `supabase/functions/face-recognize/index.ts` — Better AI accuracy

- **Increase reference photos from 2 to 4** per person (line 68: `urls.length < 4`)
- **Switch model to `gemini-2.5-pro`** for superior vision accuracy
- **Force tool call**: Change `toolChoice: "auto"` to `toolChoice: { type: "function", function: { name: "face_match_result" } }` so AI always returns structured JSON
- **Add fallback with retry**: If first AI call fails or returns no result, retry once with the same model before giving up
- **Improve prompt**: Add instruction to consider glasses, lighting variations, and angles

### 3. `src/components/timeclock/FaceCamera.tsx` — No changes needed

Camera display is fine; the resolution improvement is in the hook.

## Summary

These changes address the three main failure modes:
- Blurry/low-res captures → higher resolution + quality
- Insufficient reference data → 4 photos instead of 2
- AI model inconsistency → stronger model + forced structured output + retry

