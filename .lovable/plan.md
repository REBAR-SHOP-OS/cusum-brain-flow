

## Fix Nila: English-Only UI, Multilingual Responses, and "Not Responding" Bug

### Problems Identified

1. **Not responding**: Default mode is `silent` (mode 2), which ignores all input. Also, `recognition.onend` captures a stale `isRecognizing` value from closure, so auto-restart may fail.
2. **UI has Persian text**: The i18n system shows Persian labels when `lang === "fa"`. The UI should be English-only per project standards.
3. **Only responds in Persian**: The system prompt is hardcoded to Persian. Should respond in whatever language the user speaks.

### Changes

**1. `src/hooks/useNilaVoiceAssistant.ts`**
- Change default mode from `"silent"` to `"normal"` so Nila responds immediately
- Fix the stale closure bug in `recognition.onend` by using a ref for `isRecognizing` state
- Remove `lang` dependency from speech recognition language — instead, don't set `recognition.lang` so the browser auto-detects the spoken language
- Remove the Globe toggle and `lang` concept entirely from the hook (UI is always English)

**2. `supabase/functions/nila-chat/index.ts`**
- Update the normal-mode system prompt to: "You are a helpful voice assistant named Nila. Reply in the same language the user speaks. Keep answers short and concise."
- Remove the `lang` parameter dependency from prompt selection
- Increase `max_tokens` to 300 for normal mode (150 is too restrictive for multilingual)

**3. `src/lib/nilaI18n.ts`**
- Remove the FA translations entirely. Keep only English strings as constants (no lang switching needed).
- Simplify `getNilaT()` to always return English.

**4. `src/components/nila/NilaHeader.tsx`**
- Remove the Globe (language toggle) button
- All labels are already English from the simplified i18n

**5. `src/components/nila/NilaVoiceAssistant.tsx`**
- Remove `lang` toggle logic and `dir="rtl"` — always LTR
- Remove Globe button handler

**6. `src/components/nila/NilaTextInput.tsx`**
- Remove `dir` and `fontFamily` RTL logic — always English UI
- Keep placeholder always in English

**7. `src/components/nila/NilaChatMessages.tsx`**
- Keep RTL detection per-message for content (assistant may reply in Persian/Arabic), but remove the Vazirmatn font override — use system fonts

**8. Deploy `nila-chat`** edge function with the updated prompt.

### Summary

| File | Change |
|---|---|
| `useNilaVoiceAssistant.ts` | Default mode → normal, fix stale closure, auto-detect speech language |
| `nila-chat/index.ts` | Multilingual system prompt, increase max_tokens |
| `nilaI18n.ts` | English-only, remove FA |
| `NilaHeader.tsx` | Remove Globe button |
| `NilaVoiceAssistant.tsx` | Remove RTL/lang toggle |
| `NilaTextInput.tsx` | Remove RTL logic |
| `NilaChatMessages.tsx` | Keep per-message RTL detection, remove font override |
| Deploy `nila-chat` | Redeploy edge function |

