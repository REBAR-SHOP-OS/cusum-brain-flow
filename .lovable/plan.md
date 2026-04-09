

# Fix Vizzy Voice: Multi-Language, Listen-First, Clean Disconnect

## Problems Identified

1. **Language locked to English** — `useSpeechRecognition` is hardcoded to `lang: "en-US"` (line 195 in `useVizzyGeminiVoice.ts`). User speaks Persian but STT only recognizes English.

2. **Vizzy talks before listening** — On session start (line 226), a greeting prompt is immediately sent: `processUserInput("(Session started — give your morning briefing greeting)")`. Vizzy starts speaking a long morning briefing before the user says anything. The user wants Vizzy to listen first, then respond.

3. **Vizzy not calm/precise enough** — The system prompt says "Keep responses under 30 seconds. Punchy." and the morning briefing protocol tells Vizzy to immediately dump alerts, email triage, call data. Needs a calmer, more measured tone instruction.

4. **End Session doesn't fully disconnect** — `endSession()` stops speech recognition and clears audio queue, but currently playing audio (`isPlayingRef.current`) is not stopped. The `currentlyPlayingRef` audio element is not tracked, so clicking End Session while Vizzy is speaking leaves the current audio playing.

## Changes

### File: `src/hooks/useSpeechRecognition.ts`
- Remove the single `lang` option and instead **omit** setting `recognition.lang` so the browser auto-detects language, OR set it to empty string for auto-detect mode

### File: `src/hooks/useVizzyGeminiVoice.ts`
1. **Auto-detect language**: Remove hardcoded `lang: "en-US"` from speech recognition config (line 195)
2. **Remove auto-greeting**: Remove the `setTimeout` that sends the morning briefing prompt on session start (lines 225-227). Instead, just connect silently and wait for the user to speak first
3. **Track current audio element**: Store the currently-playing `Audio` in a ref so `endSession` can `.pause()` it
4. **Fix endSession**: Pause the currently-playing audio element, not just clear the queue

### File: `src/hooks/useVizzyVoiceEngine.ts`
- Update the system prompt's `VOICE FORMAT` and `COMMUNICATION STYLE` sections to emphasize: respond calmly, listen fully before responding, be precise and unhurried
- Update `LANGUAGE` section: "Respond in whatever language the user speaks. If Farsi, respond in Farsi. If English, respond in English. Auto-detect and match."
- Remove or soften the `MORNING BRIEFING` section that forces an immediate data dump

### File: `src/components/vizzy/VizzyVoiceChat.tsx`
- Remove the initial `"(Session started — give your morning briefing greeting)"` transcript that appears in the chat on connect (this is added by the engine, so the engine change handles it)

## Files Modified
| File | Change |
|------|--------|
| `src/hooks/useSpeechRecognition.ts` | Support auto-detect language (no hardcoded lang) |
| `src/hooks/useVizzyGeminiVoice.ts` | Remove `lang: "en-US"`, remove auto-greeting, track + stop current audio on end |
| `src/hooks/useVizzyVoiceEngine.ts` | Update prompts: calm tone, multi-language, no forced briefing |

