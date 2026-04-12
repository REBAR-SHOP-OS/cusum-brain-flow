

# Replace Browser TTS with ElevenLabs (PersonaPlex) in Vizzy Voice

## Problem
The `/vizzy-voice` page uses browser `SpeechSynthesis` for spoken output — inherently robotic. The `elevenlabs-tts` edge function already exists with human-tuned settings (multilingual_v2 model, stability 0.35, style 0.55) and `authMode: "none"`. It just needs to be wired in.

## Changes

**File: `src/pages/VizzyVoice.tsx`**

1. **Replace `playTTS` function** — swap `SpeechSynthesisUtterance` for a `fetch` call to the `elevenlabs-tts` edge function, play the returned MP3 blob via `new Audio(URL.createObjectURL(blob))`
2. **Remove browser voice controls** — drop the voice selector dropdown, rate/pitch sliders, test voice button, and the `voiceschanged` listener since they only apply to browser speech
3. **Remove `localStorage` voice prefs** — no longer needed (`vizzy-voice-uri`, `vizzy-voice-rate`, `vizzy-voice-pitch`)
4. **Remove the collapsible Voice Settings panel** — simplifies the UI
5. **Keep interrupt behavior** — on mic tap while speaking, call `audio.pause()` on the current audio element instead of `speechSynthesis.cancel()`
6. **Keep everything else** — status states, quick actions, copy/retry, safety banner, typed input all stay

## Scope
- 1 file changed: `src/pages/VizzyVoice.tsx`
- 0 backend changes — `elevenlabs-tts` edge function already deployed with `authMode: "none"`
- 0 new dependencies

