

# Fix: Short Noise Fragments Cluttering Voice Transcript

## Problem
The voice transcript displays every tiny utterance ("Good morning", "Bye-bye", "Hello", "Hello") as separate `YOU` bubbles without corresponding Vizzy responses. These short fragments are likely background noise, mic artifacts, or casual filler that should be filtered before display.

## Root Cause
`useVoiceEngine.ts` (lines 103-111) adds **every** user transcript to the display with no minimum-length filter. The project's transcription standards call for a client-side filter for short fragments (<2 words or <5 chars), but it was never implemented in the voice engine.

## Fix

### File: `src/hooks/useVoiceEngine.ts`
**Lines 103-111** — Add a filter to skip trivially short user transcripts:
- Skip user transcripts that are **fewer than 3 words AND fewer than 15 characters** (catches "Hello", "Bye-bye", "Good morning" but keeps real sentences)
- Agent transcripts remain unfiltered (Vizzy's responses always show)

This is a single 2-line addition inside the `conversation.item.input_audio_transcription.completed` handler — check `text.split(/\s+/).length < 3 && text.length < 15` before pushing to transcripts.

### No other files change
The display logic in `VizzyVoiceChat.tsx` is fine — the filtering happens at the source.

