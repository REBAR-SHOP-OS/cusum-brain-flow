

# Add Voiceover Script to Storyboard Output

## What
Add a dedicated `voiceover` field to each storyboard scene so the AI generates a voiceover narration script alongside the visual prompt. This voiceover text will be used for TTS generation and displayed in the editor.

## Current State
- `segments[].text` contains narration text but it's generic segment text, not explicitly labeled as voiceover
- The `storyboard[].prompt` only describes visuals
- Voiceover is generated later from segment text via `generate-voiceover` action

## Changes

### 1. `supabase/functions/ad-director-ai/index.ts`

**Update `ANALYZE_SCRIPT_PROMPT`** (line ~361):
Add to the `## SCENE OUTPUT` section:
```
- voiceover: The exact narration/voiceover script for this scene. Natural, conversational, punchy advertising copy. This text will be read aloud by a narrator.
```

**Update `ANALYZE_SCRIPT_TOOLS`** tool schema (line ~423-442):
Add `voiceover` property to the `storyboard` items:
```ts
voiceover: { type: "string", description: "Voiceover narration script for this scene" },
```
Add `"voiceover"` to the `required` array.

### 2. `src/types/adDirector.ts`

**Update `StoryboardScene` interface** — add:
```ts
voiceover?: string;
```

### 3. `src/components/ad-director/ProVideoEditor.tsx`

When auto-generating voiceovers, prefer `scene.voiceover` text over `segment.text` if available. This ensures the dedicated voiceover script is used for TTS.

### 4. `src/lib/backgroundAdDirectorService.ts`

When populating segments from the storyboard result, if `scene.voiceover` exists, use it as the segment `text` so the voiceover pipeline picks it up automatically.

| File | Change |
|---|---|
| `supabase/functions/ad-director-ai/index.ts` | Add voiceover to prompt instructions + tool schema |
| `src/types/adDirector.ts` | Add `voiceover` to `StoryboardScene` |
| `src/components/ad-director/ProVideoEditor.tsx` | Use `scene.voiceover` for TTS when available |
| `src/lib/backgroundAdDirectorService.ts` | Map voiceover text to segment text |

