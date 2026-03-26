

# Wire Intro & Outro Images into Video Generation Pipeline

## Problem
Users can upload intro and outro images via the UI, but these images are completely ignored — they are never uploaded to storage, never sent to the AI, and never used in video generation. The first and last scenes should visually reference these images.

## Changes

### 1. `src/lib/backgroundAdDirectorService.ts` — Upload & use intro/outro images

**Upload** (after character image upload, ~line 180):
- Upload `introImage` to `ad-assets/intro-refs/...` → get `introImageUrl`
- Upload `outroImage` to `ad-assets/outro-refs/...` → get `outroImageUrl`

**Pass to analyze-script** (~line 188):
- Add `introImageUrl` and `outroImageUrl` to the `ad-director-ai` invocation body

**Pass to write-cinematic-prompt** (~line 208):
- Add `introImageUrl` and `outroImageUrl` so the prompt writer knows about them

**Phase 2 video generation** (~line 343):
- For the **first scene** (i === 0): if `introImageUrl` exists, use `wan2.6-i2v` model with `imageUrl: introImageUrl` (same pattern as character image)
- For the **last non-end-card scene**: if `outroImageUrl` exists, use `wan2.6-i2v` with `imageUrl: outroImageUrl`
- Priority: if both `characterImageUrl` AND intro/outro exist, intro/outro takes precedence for the first/last scene

### 2. `supabase/functions/ad-director-ai/index.ts` — Tell AI about intro/outro images

**`handleAnalyzeScript`** (~line 509):
- Destructure `introImageUrl`, `outroImageUrl` from body
- When `introImageUrl` present, add instruction: "An INTRO reference image has been provided. Scene 1 (hook) MUST visually match and be inspired by this image. Set generationMode to 'image-to-video' for scene 1."
- When `outroImageUrl` present, add instruction: "An OUTRO reference image has been provided. The last visual scene (before end card) MUST visually match and be inspired by this image. Set generationMode to 'image-to-video' for that scene."

**`handleWriteCinematicPrompt`** (~line 539):
- When writing a prompt for the first scene and `introImageUrl` exists, append: "INTRO REFERENCE: A reference image is provided for this opening scene. The prompt MUST describe visuals that closely match the composition, colors, and style of this reference image."
- Same for outro on the last visual scene.

### 3. `supabase/functions/generate-video/index.ts` — No change needed
The existing `wanI2vGenerate` routing already handles `imageUrl` — same mechanism used for character images.

## Summary

| File | Change |
|---|---|
| `backgroundAdDirectorService.ts` | Upload intro/outro images to storage; pass URLs to AI; use as i2v reference for first/last scenes |
| `ad-director-ai/index.ts` | Add intro/outro context blocks in analyze-script and write-cinematic-prompt handlers |

