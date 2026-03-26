

# Add Voiceover Script to Auto-Generated Prompt

## Problem
The auto-generate button creates a visual prompt but does not include a Voiceover section. Per previous changes, the storyboard pipeline now supports voiceover — the auto-generated prompt should always include one.

## Changes

### `src/components/ad-director/ChatPromptBar.tsx` — `handleAutoGenerate` (lines 96-107)

Update the system prompt and instructions to always produce both a visual prompt AND a voiceover script, separated by a clear marker:

**System prompt update (line 99):**
```
"You are a cinematic video ad prompt writer for a construction/rebar company.
Write a single concise, vivid video prompt (2-3 sentences) for the given parameters.
Then on a new line, write '---VOICEOVER---' followed by a professional voiceover narration script (2-4 sentences) matching the video content.
The voiceover should be persuasive advertising copy suitable for text-to-speech.
Return ONLY the prompt text and voiceover, no quotes or extra formatting."
```

**Result parsing (lines 105-107):**
Parse the response to split at `---VOICEOVER---` and format the output as:
```
[Visual Prompt]

🎙️ Voiceover:
[Voiceover Script]
```

This way the voiceover is always visible in the prompt textarea and gets passed along with the prompt to the storyboard generation pipeline.

| File | Change |
|---|---|
| `ChatPromptBar.tsx` | Update system prompt to require voiceover + parse/format output |

