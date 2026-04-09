
Goal: make Vizzy actually listen to the user, answer the spoken question, stop self-talking, and support multilingual speech in a reliable way.

What I found:
1. In `src/hooks/useVizzyGeminiVoice.ts`, speech recognition stays active while Vizzy audio is playing. `playNext()` plays TTS, but it never pauses `useSpeechRecognition`. That means the microphone can hear Vizzy’s own voice and feed it back as new input. This is the main reason it feels like Vizzy “talks to itself” or answers things the user did not say.
2. In the same file, `processUserInput()` immediately returns when `processingRef.current` is already true. So if the user speaks while Vizzy is thinking or speaking, that turn is dropped instead of queued. This is why it feels like Vizzy is not listening.
3. In `src/hooks/useVizzyVoiceEngine.ts`, the voice system prompt is still overloaded with proactive behavior: self-audit, executive summaries, auto-tasking, quick replies, greetings, and business briefings. That prompt strongly pushes Vizzy to lead the conversation instead of simply answering the user’s sentence.
4. The prompt also contains a strong “ignore background noise” instruction. For short phrases, the model can incorrectly treat real user speech like ambient sound and answer with unrelated refusal/explanation text.
5. “Support all languages” is not truly implemented. `src/hooks/useSpeechRecognition.ts` uses the browser Web Speech API with only one optional `lang`. In Vizzy it is left unset, which is not true multilingual auto-detection. In practice it usually falls back to browser/page language behavior, so many languages will be inconsistent or missed.

Implementation plan:
1. Fix turn-taking in `src/hooks/useVizzyGeminiVoice.ts`
   - Stop or pause speech recognition before TTS playback starts
   - Restart listening only after Vizzy finishes speaking
   - Ignore any transcript events while Vizzy is speaking
   - Add a small input queue so user speech is processed in order instead of dropped

2. Make voice mode answer-driven instead of proactive in `src/hooks/useVizzyVoiceEngine.ts`
   - Remove voice prompt sections that push Vizzy to self-start reports or briefings
   - Remove self-audit/session-start behavior from voice mode
   - Change the prompt to: listen first, answer only the user’s exact request, do not add unrelated commentary, do not create actions unless explicitly asked

3. Tighten short-utterance handling
   - Do not let the model decide that normal short user phrases are “background noise”
   - Keep background filtering in the STT layer, not as a dominant behavior instruction in the LLM prompt
   - Prefer “ask for repeat” only when the captured transcript is clearly empty or low-confidence

4. Make multilingual support real
   - Best fix: replace browser-only speech recognition for Vizzy with a proper multilingual transcription path
   - If keeping browser STT, add explicit language selection/fallback instead of claiming universal support
   - Current architecture cannot honestly guarantee “all languages” with browser auto-detect alone

5. Keep End Session fully hard-stop
   - Also clear any queued user utterances and pending model-response flow
   - Ensure no residual STT restart happens after closing

Expected result:
- Vizzy listens first
- answers the actual spoken question
- stops reacting to its own TTS
- no longer drops user turns while busy
- multilingual behavior becomes explicit and reliable instead of unpredictable

Technical evidence:
- `src/hooks/useVizzyGeminiVoice.ts`: recognition starts in `startSession()` and remains active; `playNext()` never pauses STT
- `src/hooks/useVizzyGeminiVoice.ts`: `if (!text.trim() || processingRef.current) return;` drops turns
- `src/hooks/useVizzyVoiceEngine.ts`: prompt still includes heavy proactive sections like `SELF-AUDIT ON SESSION START`
- `src/hooks/useSpeechRecognition.ts`: only one browser recognition language is supported; unset language is not true all-language support
