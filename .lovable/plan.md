
# Remove Text from Generated Videos

## Problem
The AI video generation models (Wan, Veo, Sora) are rendering the descriptive prompt text as visual text inside the generated video frames. The user sees the cinematic prompt description overlaid on the actual video content.

## Root Cause
Video generation AI models sometimes interpret descriptive text in prompts as instructions to render text in the video. The current `negativePrompt` only includes `"text overlay"` as a weak signal. The system prompts already say "NO text/titles/brand names in video prompts" but this only controls what the AI prompt writer outputs — it doesn't instruct the video generation model itself to avoid rendering text.

## Solution
Add explicit "no text" instructions at every level where prompts reach video generation models.

### Changes

| File | Change |
|---|---|
| `src/lib/backgroundAdDirectorService.ts` | 1. Strengthen `negativePrompt` to explicitly forbid all text rendering. 2. Append a "no text" suffix to every `motionPrompt` before sending to generate-video |
| `src/components/ad-director/AdDirectorContent.tsx` | Same treatment for the single-scene regeneration path |
| `src/components/social/VideoStudioContent.tsx` | Append "no text" suffix to prompts in VideoStudio generation paths |
| `supabase/functions/generate-video/index.ts` | Server-side safety net: always append "no text" instruction to any prompt before sending to Wan/Veo/Sora APIs, and strengthen negative prompt |
| `supabase/functions/ad-director-ai/index.ts` | Add explicit instruction in ANALYZE_SCRIPT_PROMPT and WRITE_CINEMATIC_PROMPT_SYSTEM: "NEVER describe any text, words, letters, typography, titles, or written content in the video prompt" |
| `supabase/functions/transform-video-prompt/index.ts` | Add rule to SYSTEM_PROMPT: "NEVER include any text, words, letters, or typography descriptions in the output prompt" |

### Key additions

**Negative prompt** (strengthened):
```
"static image, zoom only, no motion, blurry, text, words, letters, titles, subtitles, captions, watermark, typography, written content, overlay text, any text of any kind"
```

**Prompt suffix** (appended to every video prompt):
```
" No text, no words, no letters, no titles, no typography, no written content anywhere in the video."
```

**Edge function safety net** (in generate-video):
Before sending to any provider API, strip any remaining text-rendering instructions and append the no-text suffix — ensuring zero text in generated videos regardless of what the prompt says.
