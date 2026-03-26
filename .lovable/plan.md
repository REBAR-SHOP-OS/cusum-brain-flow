

# Strengthen Cross-Scene Coherence in AI Video Director

## Problem
When a user writes a prompt, the AI correctly breaks it into scenes with continuity metadata. However, each video clip is generated **independently** — the video model only sees its own scene prompt. This causes disconnected visuals (different colors, subjects, environments) across clips that should form one cohesive film.

## Current Architecture
The system already has good continuity infrastructure:
- `continuityProfile` with subject descriptions, wardrobe, environment, lighting, color mood
- `previousScene` context passed to `write-cinematic-prompt`
- `continuityRequirements` field per scene

**Gap**: These continuity details are used for prompt *writing* but not strongly enough enforced. The `motionPrompt` sent to the video generator is just `scene.prompt + "Cinematic camera movement..."` — it doesn't embed the continuity profile.

## Solution
Strengthen coherence at two levels: prompt generation and video generation.

### 1. `supabase/functions/ad-director-ai/index.ts` — Enhance ANALYZE_SCRIPT_PROMPT
Add explicit rules requiring scene-to-scene visual consistency:
- Add a new section `## COHERENCE RULES` requiring:
  - All scenes must share the same color palette, lighting style, and environment type unless the script explicitly changes location
  - Each scene prompt must begin with a "continuity anchor" referencing the global visual identity
  - Subject descriptions must be identical across scenes (same person, same clothing, same props)
- Strengthen the prompt template: "Every scene prompt MUST start with: 'Continuing the same [environment/subject/lighting] from previous scenes...'" for scenes after the first

### 2. `supabase/functions/ad-director-ai/index.ts` — Enhance WRITE_CINEMATIC_PROMPT_SYSTEM
Update the cinematic prompt writer to:
- Mandate that every prompt after scene 1 begins with a visual continuity statement referencing the continuity profile
- Include the full continuity profile (subject, wardrobe, environment, lighting, color mood) as a required prefix block in every generated prompt
- Instruct: "The viewer must feel all clips are from the same film shoot, same location, same day, same camera setup"

### 3. `src/lib/backgroundAdDirectorService.ts` — Inject continuity context into video generation prompt
In Phase 2 (line ~333), instead of just appending "Cinematic camera movement...", prepend the continuity profile to every scene prompt:
```
const continuityPrefix = `[Visual continuity: ${continuityProfile.environment}, ${continuityProfile.lightingType}, ${continuityProfile.colorMood}, subject: ${continuityProfile.subjectDescriptions}] `;
const motionPrompt = continuityPrefix + scene.prompt + " Cinematic camera movement...";
```
This ensures the video model receives the same visual anchors for every clip.

### 4. `supabase/functions/ad-director-ai/index.ts` — Add `handleWriteCinematicPrompt` continuity enforcement
In the user prompt for `write-cinematic-prompt` (line ~517), add the full continuity profile as a mandatory inclusion block, not just an optional reference. The AI must weave these details into every prompt it writes.

## Summary of Changes

| File | Change |
|---|---|
| `ad-director-ai/index.ts` | Add COHERENCE RULES to ANALYZE_SCRIPT_PROMPT; strengthen WRITE_CINEMATIC_PROMPT_SYSTEM with mandatory continuity anchors; enhance handleWriteCinematicPrompt to inject full continuity context |
| `backgroundAdDirectorService.ts` | Prepend continuity profile summary to every video generation prompt |

