
## Issue identified

I inspected the interpreter flow and there are three concrete problems causing the “Listening…” state without useful output:

1. `src/hooks/useAzinVoiceRelay.ts` drops short real phrases before translation:
   - current filter rejects anything with fewer than 3 words or under 8 chars
   - normal interpreter inputs like `سلام`, `مرسی`, `yes`, `no`, `okay` get discarded

2. `supabase/functions/translate-message/index.ts` strips valid one-word English translations:
   - it currently requires at least 2 words for English output
   - so `سلام → Hello` becomes empty, the client removes the transcript, and TTS never runs

3. Audio playback is not primed from a user gesture:
   - the voice overlay auto-starts after mount
   - TTS audio is created and played asynchronously later
   - on many browsers this gets blocked by autoplay rules
   - the current code swallows `audio.play()` failures, so it looks like nothing happens

## What I will change

### 1) Fix the relay filtering
File: `src/hooks/useAzinVoiceRelay.ts`

- relax transcript filters to allow short but meaningful interpreter phrases
- keep noise protection, but stop rejecting legitimate short EN/FA speech
- preserve filtering for punctuation, annotations, obvious garbage, and foreign scripts

### 2) Fix translation post-validation
File: `supabase/functions/translate-message/index.ts`

- stop requiring 2 English words
- allow valid one-word translations in both English and Farsi
- replace the current word-count rule with a lighter sanity check so short real translations survive

### 3) Fix browser audio unlock
Files:
- `src/pages/AzinInterpreter.tsx`
- `src/components/azin/AzinInterpreterVoiceChat.tsx`
- `src/hooks/useAzinVoiceRelay.ts`
- likely reuse `src/lib/audioPlayer.ts`

Plan:
- prime audio synchronously when the user taps the Nila avatar button
- pass that primed playback capability into the voice chat flow
- use the primed audio element / unlocked audio path for TTS playback
- stop silently swallowing playback failures; surface them in logs and optionally toast once

### 4) Improve runtime diagnostics
File: `src/hooks/useAzinVoiceRelay.ts`

- log whether failure is:
  - no committed transcript
  - empty translation returned
  - TTS request failed
  - audio playback blocked
- this prevents another “looks connected but does nothing” situation

## Expected result

After these changes:

- short phrases like `سلام`, `مرسی`, `بله`, `yes`, `no`, `okay` will translate instead of disappearing
- the interpreter will actually produce translated text entries
- TTS playback will work reliably on browser/mobile autoplay-restricted environments
- if playback still fails, the error will be visible instead of silently ignored

## Technical notes

```text
Current failing path:
voice chat opens
→ STT partial appears
→ short phrase filtered OR translation emptied
→ transcript removed
→ no TTS
OR
→ TTS succeeds but browser blocks async audio playback
→ play() error swallowed
→ user hears nothing
```

```text
Fix path:
user taps Nila
→ audio is primed during click
→ STT commits short valid phrase
→ translation preserves one-word outputs
→ TTS plays through unlocked audio path
```

## Verification after implementation

1. Test with short Farsi inputs:
   - `سلام`
   - `مرسی`
   - `بله`

2. Test with short English inputs:
   - `hello`
   - `thanks`
   - `yes`

3. Confirm all 3 layers work:
   - partial transcript appears
   - committed translation renders
   - audio speaks the translated phrase

4. Re-test on the overlay flow specifically, not just the split-screen mic mode

5. During QA, dismiss the training modal first because it can block interaction while testing the interpreter page
