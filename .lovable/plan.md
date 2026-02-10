
# Improve Translation Writing Style

## Problem
The translated output reads like a rough, literal transcription rather than polished, professional prose. The current prompts prioritize word-for-word accuracy over natural readability.

## Solution
Enhance the system prompts in the `transcribe-translate` edge function to produce more polished, publication-quality English output.

### Changes (single file: `supabase/functions/transcribe-translate/index.ts`)

**1. Enhance TRANSLATOR_PERSONA (line 18-31)**
Add writing style instructions to the existing persona:
- Produce clear, well-structured sentences with proper punctuation
- Break long run-on speech into clean, readable sentences
- Eliminate filler words and verbal tics (um, uh, you know) from translations
- Use professional prose conventions: proper paragraphing, logical flow
- Spoken language should be elevated to written-quality English without losing meaning

**2. Strengthen Pass 2 reviewer prompt (line 59-78)**
Add explicit style refinement duties:
- Rewrite run-on sentences into clean, concise prose
- Remove verbal filler and repetition from spoken-to-written conversion
- Ensure the final text reads like professionally written content, not raw speech-to-text
- Improve sentence structure, flow, and readability while preserving all meaning
- Prioritize clarity and elegance in the final output

## Technical Details

The edge function `supabase/functions/transcribe-translate/index.ts` will be updated in two sections:

1. **TRANSLATOR_PERSONA constant** -- add a new `WRITING STYLE` section with rules for clean prose output
2. **buildPass2SystemPrompt function** -- add writing quality refinement as a core reviewer responsibility, making it step 1 (before accuracy checking)

No frontend changes needed. No database changes. The function will be redeployed automatically.
