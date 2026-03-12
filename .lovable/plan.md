

# Fix AI Command Bar: Overlay Edits vs. Full Regeneration

## Problem
When the user types "add logo to hard hats" in the AI command bar, the system rewrites the text prompt and regenerates a completely new video. Text-to-video models cannot add a real logo to existing footage — they just generate new random footage. The user wants to apply edits (like logo placement, text overlays) to the **existing** video without regeneration.

## Solution

Add an **intent classification** step before processing AI commands. The edge function will classify the user's command into two categories:

1. **Overlay commands** (add logo, add text, add watermark, add sticker) → Return overlay metadata (type, position, content) that the frontend applies as CSS/canvas overlays on the existing video. No regeneration.
2. **Generative commands** (change style, change lighting, remove object, change background) → Current behavior: rewrite prompt and regenerate.

### Changes

### 1. `supabase/functions/edit-video-prompt/index.ts`
- Add intent classification to the AI system prompt. The AI must first decide if the edit is an **overlay** (non-destructive, applied on top) or **generative** (requires new video).
- For overlay intents, return `{ type: "overlay", overlay: { kind: "logo"|"text"|"shape", position, size, content } }` instead of `{ editedPrompt }`.
- For generative intents, keep current behavior returning `{ type: "generative", editedPrompt }`.

### 2. `src/components/ad-director/ProVideoEditor.tsx`
- Update `handleAiSubmit` to check the response type.
- If `type === "overlay"`: add the overlay to a local `overlays[]` state array and render it as an absolutely-positioned element on top of the video player. Do NOT call `onRegenerateScene`.
- If `type === "generative"`: keep current behavior (update prompt + regenerate).
- Add overlay rendering layer on top of the video element (logo images, text boxes) with drag/resize support later.

### 3. `src/types/adDirector.ts` (or new `src/types/videoOverlay.ts`)
- Add `VideoOverlay` type: `{ id, kind: "logo"|"text", position: {x,y}, size: {w,h}, content: string, sceneId: string }`.

## Files Modified
- `supabase/functions/edit-video-prompt/index.ts` — add intent classification
- `src/components/ad-director/ProVideoEditor.tsx` — handle overlay responses, render overlay layer
- `src/types/adDirector.ts` — add VideoOverlay type

