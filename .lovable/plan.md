

# Scene-Based Auto-Generate Prompt with Per-Scene Voiceover

## Problem
The auto-generate (Sparkles) button currently produces a single flat prompt + one voiceover block. The user wants it to produce **structured scene-by-scene output** based on the selected duration, with each scene having its own visual prompt and voiceover — matching the project's 15-second-per-scene standard.

## Duration → Scene Mapping
- **15s** → 1 scene (0–15s)
- **30s** → 2 scenes (0–15s, 15–30s)
- **60s** → 4 scenes (0–15s, 15–30s, 30–45s, 45–60s)

## Output Format Example (30s)
```
Scene 1 – 0 to 15 sec
Dark cinematic background, slow reveal of complex structural project.
Voiceover:
"In modern construction, precision is not optional — it is fundamental."

Scene 2 – 15 to 30 sec
Close-up of rebar cages being lifted by crane at golden hour.
Voiceover:
"With every bar placed, we build strength that lasts generations."
```

## Changes

### `src/components/ad-director/ChatPromptBar.tsx`

Update the `handleAutoGenerate` function:

1. **Calculate scene count** from duration: `Math.max(1, parseInt(duration) / 15)`
2. **Update system prompt** to instruct the AI to write exactly N scenes, each with a visual prompt and voiceover, in the structured format above
3. **Update context lines** to include scene count
4. **Remove the old `---VOICEOVER---` split logic** — the new format is directly human-readable and will be set into the prompt textarea as-is
5. Keep all existing image context (Intro → Scene 1, Character → all scenes, Outro → last scene)

### System Prompt Update (key part)
```
"Write exactly {N} scenes for a {duration} video ad."
"Each scene is exactly 15 seconds."
"Format each scene as:"
"Scene X – Ys to Zs"
"[Visual prompt: 1-2 sentences, cinematic, specific]"
"Voiceover:"
"\"[Persuasive ad copy, 1-2 sentences]\""
"Separate scenes with a blank line."
```

| File | Change |
|---|---|
| `src/components/ad-director/ChatPromptBar.tsx` | Update `handleAutoGenerate` to produce scene-structured prompts with per-scene voiceover based on selected duration |

