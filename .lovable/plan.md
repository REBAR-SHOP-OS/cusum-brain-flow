
Goal: make Vizzy audible on phone, reduce the delay, and fine-tune the voice without changing the ERP query flow or endpoint behavior.

Do I know what the issue is? Yes.

What I found
- The main mobile bug is in `src/hooks/useVizzyGeminiVoice.ts`: the app primes mobile audio on tap, but later throws that primed playback path away and creates a fresh `new Audio(url)` after the async TTS fetch. On phones, that new element can lose the unlocked playback context, so Vizzy hears you and shows text but no sound comes out.
- The simple `/vizzy-voice` page has a similar weakness: `speechSynthesis.speak()` happens only after the async backend reply, with no proper mobile output-unlock tied to the user gesture.
- The delay feels worse because the UI does not distinguish “thinking” vs “generating voice” vs “audio blocked”.

Implementation plan
1. Fix the real mobile playback failure
- Update `src/hooks/useVizzyGeminiVoice.ts` to reuse a primed audio element for returned TTS blobs instead of creating a new `Audio(...)`.
- Add mobile-safe playback flags (`playsInline`, `preload="auto"`), wait for media readiness, and re-arm playback after interruption.

2. Harden shared mobile audio utilities
- Extend `src/lib/audioPlayer.ts` so Vizzy can prime once during the tap and then safely swap in the real TTS audio later.
- Keep the same query/backend flow; only playback handling changes.

3. Add blocked-audio recovery UI
- Update `src/components/vizzy/VizzyVoiceChat.tsx` to surface a small “Tap to enable audio” retry when playback is blocked.
- Implement the currently stubbed `outputAudioBlocked` / `retryOutputAudio()` path from the hook so failures are recoverable instead of silent.

4. Fine-tune the voice
- Adjust the backend TTS settings in `supabase/functions/elevenlabs-tts/index.ts` for a less robotic sound and slightly snappier response.
- Keep the same endpoint and request shape.

5. Bring the simple Vizzy Voice page up to the same standard
- Update `src/pages/VizzyVoice.tsx` to prime speech output on mic tap, typed send, and test-speak.
- Improve `voiceschanged` handling, set `utter.lang` from the chosen voice, and tighten the auto-selection toward the best natural English voice on the device.

Files to update
- `src/lib/audioPlayer.ts`
- `src/hooks/useVizzyGeminiVoice.ts`
- `src/components/vizzy/VizzyVoiceChat.tsx`
- `src/pages/VizzyVoice.tsx`
- `supabase/functions/elevenlabs-tts/index.ts`

Validation after implementation
- Test on phone from the current home-screen Vizzy flow and the `/vizzy-voice` page.
- Confirm: tap once, speak, text appears, audible reply plays on the same turn.
- Confirm: no silent replies after tab switch / screen lock.
- Confirm: clearer status text and more natural voice tone.
