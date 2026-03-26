

# Auto-Prompt Based on Uploaded Images (Intro/Character/Outro)

## Problem
Currently, the auto-generate prompt (Sparkles button) only uses selected products, styles, duration, and ratio. It ignores uploaded Intro Image, Character, and Outro Image. The user wants the AI to incorporate these images into the generated prompt.

## Approach

Update `handleAutoGenerate` in `ChatPromptBar.tsx` to:
1. **Expand `canAutoGenerate` condition** — allow auto-generation when images are uploaded OR (products + styles selected), not only when both products and styles are selected
2. **Describe uploaded images in the AI prompt** — add context lines like "Intro Image: uploaded (reference frame for opening scene)", "Character: uploaded (consistent narrator/person across scenes)", "Outro Image: uploaded (reference frame for closing scene)"
3. **Update the system prompt** — instruct the AI to weave image references into the cinematic prompt:
   - If Intro Image exists → describe opening scene that matches/starts from the uploaded reference image
   - If Character exists → include a consistent human narrator/subject throughout the video
   - If Outro Image exists → describe closing scene that transitions to the uploaded reference image

## Changes

### `src/components/ad-director/ChatPromptBar.tsx`

| Area | Change |
|---|---|
| `canAutoGenerate` (line 86) | Change to: `selectedStyles.length > 0 && selectedProducts.length > 0` **OR** any image is uploaded (`introImage \|\| outroImage \|\| characterImage`) |
| `handleAutoGenerate` (lines 88-122) | Add image context lines to the prompt sent to `ai-generic`. Update system prompt to instruct AI on how to use intro/outro/character references |
| Tooltip text (line 519) | Update hint to reflect that images also enable auto-generation |

**Updated prompt construction:**
```
Products: ... (if any)
Styles: ... (if any)
Duration: ...
Aspect Ratio: ...
Intro Image: YES — use as opening reference frame
Character Image: YES — maintain this person as narrator across all scenes
Outro Image: YES — use as closing reference frame
```

**Updated system prompt addition:**
```
If an Intro Image is provided, start the video with a scene matching that image.
If a Character Image is provided, feature that person consistently as the narrator/subject.
If an Outro Image is provided, end the video transitioning to match that image.
```

