

# Balance Video Duration with Voiceover Length

## Problem
The storyboard prompt (lines 369-381) assigns scene durations based on visual pacing rules (e.g. "Hook: 2-3s", "Solution: 3-5s") without considering how many words the voiceover text contains. A scene with 20 words of narration gets assigned 3 seconds, but natural speech at ~2.5 words/second needs 8 seconds — forcing the editor to speed up voiceover to 1.6x (ProVideoEditor.tsx line 346). This creates an unpleasant, rushed viewing experience.

## Fix

### `supabase/functions/ad-director-ai/index.ts` — Add voiceover-aware pacing rule

Insert a new rule in the `ANALYZE_SCRIPT_PROMPT` (after the PACING & RHYTHM section, ~line 381) that instructs the AI to:

1. Calculate minimum scene duration from word count: `ceil(wordCount / 2.5)` seconds (natural speech pace ~2.5 words/sec)
2. Use `max(visual_pacing_duration, voiceover_duration)` as the final scene duration
3. If total exceeds the ad length, trim visual-only scenes (intro, end card) or split long narration across two scenes — never compress speech speed

Add this block after line 381:

```
### 4b. VOICEOVER-AWARE DURATION (MANDATORY)
- For every scene with narration text, calculate: minDuration = ceil(wordCount / 2.5)
- Natural speech pace is ~2.5 words per second. NEVER assign a scene duration shorter than its narration requires
- Final scene duration = max(visual pacing suggestion, voiceover minimum duration)
- If total duration exceeds the ad length budget, shorten non-narrated scenes (intro, end card) or split long narration segments into two scenes
- NEVER rely on speeding up voiceover playback to fit — the viewer must hear every word at natural pace
- Example: A segment with 25 words needs at least ceil(25/2.5) = 10 seconds, regardless of visual pacing rules
```

## Files Changed
- `supabase/functions/ad-director-ai/index.ts` (add ~7 lines to system prompt)

