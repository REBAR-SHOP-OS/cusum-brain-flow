

# Fix Face Recognition — Improve AI Prompt for Better Matching

## Problem
Users get "Recognition Error" or "No Match" despite being enrolled. The screenshot shows a clear face but the system fails to recognize it.

## Root Cause Analysis

There is **no hardcoded distance threshold** — this system uses AI vision (Gemini 2.5 Flash) to visually compare photos. The issue is in the **AI prompt** which says:

> "Be strict: only match if you are genuinely confident the person is the same"

This instruction makes the AI too conservative, returning low confidence scores or no-match results under real-world conditions (lighting, angle, webcam quality vs enrollment photo quality).

Additionally, the frontend threshold at line 90 requires `confidence >= 95` for auto-match, and `>= 50` for low-confidence match. The backend also gates at `confidence >= 50`.

## Plan

### 1. `supabase/functions/face-recognize/index.ts` — Relax the AI prompt

**Change the prompt** from overly strict to balanced:
- Remove "Be strict" instruction
- Add explicit guidance to be tolerant of lighting, angle, expression, and webcam quality differences
- Instruct the AI that if the person looks like the same individual, confidence should be 70+
- Keep anti-spoofing awareness (photos of photos, etc.)

**Lower the backend match threshold** from `confidence >= 50` to `confidence >= 40` (line 247) to catch more borderline cases that the frontend already handles with its "low confidence" UI.

### 2. `src/hooks/useFaceRecognition.ts` — Lower frontend thresholds

- Change high-confidence threshold from `>= 95` to `>= 75` (line 90) — this triggers auto-punch
- Keep low-confidence threshold at `>= 50` (line 101) — this shows the confirmation dialog

### 3. Improve image quality

In `captureFrame()`, increase JPEG quality from `0.7` to `0.85` for better image detail sent to AI.

## Files Changed
- `supabase/functions/face-recognize/index.ts` — relaxed prompt + lower backend threshold
- `src/hooks/useFaceRecognition.ts` — lower frontend confidence thresholds + better image quality

## Scope
- No changes to any other users, routes, or components
- No database changes

