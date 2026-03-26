

# Integrate Character Image as Video Narrator/Spokesperson

## Problem
The Character photo upload (👤) works — the image is uploaded and its URL is sent to the edge functions. However:
1. `ad-director-ai` ignores `characterImageUrl` in both `handleAnalyzeScript` and `handleWriteCinematicPrompt`
2. `backgroundAdDirectorService` always uses text-to-video (`wan2.6-t2v`) — never switches to image-to-video (`wan2.6-i2v`) even when a character reference is available

## Solution
Wire character image through the entire pipeline so the person appears as narrator/spokesperson in all scenes.

## Changes

### 1. `supabase/functions/ad-director-ai/index.ts`

**`handleAnalyzeScript` (line ~509)**:
- Destructure `characterImageUrl` from body
- When present, add to the user prompt: "IMPORTANT: A reference photo of the spokesperson/narrator has been provided. This person MUST appear in EVERY scene as the primary subject presenting/demonstrating the product. Describe this person consistently across all scenes. Use generationMode: 'image-to-video' for scenes featuring this person."
- Add to `ANALYZE_SCRIPT_PROMPT`: a new section about CHARACTER/NARRATOR rules — when a character reference exists, the storyboard must feature that person in every non-end-card scene, set `generationMode: "image-to-video"`, and include the character in continuityProfile

**`handleWriteCinematicPrompt` (line ~530)**:
- Destructure `characterImageUrl` from body
- When present, append to the user prompt: "CHARACTER REFERENCE: A real person's photo is provided as the narrator/spokesperson. The prompt MUST describe this person as the central subject performing actions in this scene. Never replace them with a generic person."

### 2. `src/lib/backgroundAdDirectorService.ts`

**Phase 2 video generation (line ~340)**:
- Check if `characterImageUrl` exists AND scene's `generationMode === "image-to-video"`
- If yes: call `generate-video` with `model: "wan2.6-i2v"` and pass `imageUrl: characterImageUrl` so the Wan I2V model uses the person's photo as the starting frame
- If no: continue with existing text-to-video flow

**Specifically** (around line 343-350), change the `invokeEdgeFunction("generate-video", {...})` call:
- Add `imageUrl: characterImageUrl` when character image exists
- Change `model` from `"wan2.6-t2v"` to `"wan2.6-i2v"` when using character image

### 3. `supabase/functions/generate-video/index.ts`

**In the generate action handler**: When `imageUrl` is provided in the body alongside `provider: "wan"`, route to `wanI2vGenerate` instead of `wanGenerate`. The `wanI2vGenerate` function already exists (line 234) and accepts `imageUrl`.

## Summary

| File | Change |
|---|---|
| `ad-director-ai/index.ts` | Use `characterImageUrl` in analyze-script and write-cinematic-prompt to instruct AI to feature the person as narrator |
| `backgroundAdDirectorService.ts` | Switch to image-to-video model when character image exists |
| `generate-video/index.ts` | Route to `wanI2vGenerate` when `imageUrl` is provided with Wan provider |

