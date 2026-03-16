

# Focus on Main Speakers & Filter Background Noise

## Problem
The transcription system captures all audio equally — main speakers and background side-conversations alike. The user wants only the primary (louder, clearer) speakers to be transcribed, with background chatter filtered out.

## Approach

There are two layers where we can improve this:

### Layer 1: Microphone-level noise suppression (already active)
The `useRealtimeTranscribe.ts` already enables `echoCancellation`, `noiseSuppression`, and `autoGainControl`. This helps but doesn't distinguish main vs. side speakers.

### Layer 2: AI post-processing filter (translate-message prompt update)
Update the `translate-message` system prompt to instruct the AI to identify and discard fragments that appear to be background/side conversations — short mumbles, incomplete fragments, off-topic interjections — and only translate clear, coherent speech from the main speaker(s).

### Layer 3: Short fragment filtering (client-side)
Add a minimum text length filter in `useRealtimeTranscribe.ts` to skip very short committed transcripts (e.g., under 3 words) that are likely background noise or partial side-conversation fragments.

## Changes

### 1. `supabase/functions/translate-message/index.ts` — Update system prompt
Add instructions to filter background noise at the AI level:
- "If the text appears to be background chatter, a side conversation fragment, or unintelligible mumbling (very short, incomplete, or incoherent), return empty strings for all languages"
- "Focus only on clear, coherent speech from the main speaker(s)"

### 2. `src/hooks/useRealtimeTranscribe.ts` — Add minimum length filter
In `onCommittedTranscript`, skip segments that are too short (under 2 words or under 5 characters) before sending to the translation API — these are almost always background noise.

## Files
- **Edit**: `supabase/functions/translate-message/index.ts`
- **Edit**: `src/hooks/useRealtimeTranscribe.ts`

