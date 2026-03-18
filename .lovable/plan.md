

## Audit: Vizzy vs AZIN Voice Architecture

### Current State

Both agents already use **different backends and different prompts**, but they share one common engine (`useVoiceEngine.ts` → OpenAI Realtime WebRTC). Here's the breakdown:

| Aspect | Vizzy (CEO Assistant) | AZIN (Interpreter) |
|--------|----------------------|-------------------|
| Hook | `useVizzyVoiceEngine` | `useAzinVoiceInterpreter` |
| Backend | `voice-engine-token` (OpenAI Realtime) | `voice-engine-token` (OpenAI Realtime) |
| Voice | `shimmer` | `alloy` |
| Model | `gpt-4o-mini-realtime-preview` | `gpt-4o-mini-realtime-preview` |
| Prompt | Executive Intelligence (long, ERP data injected) | Pure translation relay (strict rules) |
| ERP Context | Yes — fetches `vizzy-daily-brief` before connecting | No |
| UI | Dark radial gradient, teal theme, "LIVE SESSION" | Standard backdrop-blur, primary theme |
| ElevenLabs | `useVizzyVoice` (legacy, uses `elevenlabs-conversation-token`) | Not used |

### What's Already Different
- Prompts are completely different and role-appropriate
- Vizzy injects live ERP data; AZIN does not
- Different voices (`shimmer` vs `alloy`)
- Different VAD settings (Vizzy: 0.5/500ms/300ms; AZIN: 0.4/300ms/200ms — AZIN is more responsive for rapid translation)
- UI components are separate files with distinct styling

### What Could Be Improved

1. **AZIN's transcript labels say "AZIN" for agent responses** — but for an interpreter, it should show the language direction (e.g., "English" / "فارسی") instead of "You" / "AZIN", since AZIN is just a relay, not a participant.

2. **AZIN uses the same OpenAI Realtime model as Vizzy** — both use `gpt-4o-mini-realtime-preview`. This is fine technically since the prompts differentiate behavior, but AZIN could benefit from even lower latency settings.

3. **No visual differentiation in the voice orb styling** — Vizzy uses teal (`hsl(172 66% 50%)`), AZIN also uses teal/primary ring colors. AZIN should use its own color identity (indigo/violet, matching its gradient `from-indigo-500 to-violet-600` on the Home page).

4. **The legacy `useVizzyVoice` hook (ElevenLabs)** still exists but is unused by the main VizzyVoiceChat component (which uses `useVizzyVoiceEngine`). This is dead code.

### Proposed Changes

**1. `src/components/azin/AzinInterpreterVoiceChat.tsx`**
- Change transcript labels from "You" / "AZIN" to "🎙️ Original" / "🔄 Translation" to reinforce that AZIN is invisible
- Update ring/glow colors from teal/primary to indigo/violet (`hsl(245 58% 55%)`) to match AZIN's brand identity on the Home page
- Change status text from "AZIN is translating..." to just "Translating..."

**2. `src/components/azin/AzinVoiceOrb.tsx`** (if exists)
- Update colors to indigo/violet to match

**3. Remove dead code: `src/hooks/useVizzyVoice.ts`**
- This ElevenLabs-based hook is no longer used (VizzyVoiceChat uses `useVizzyVoiceEngine` instead). Remove to avoid confusion.

### What stays the same
- Both hooks continue using `useVoiceEngine` with their distinct configs
- Vizzy keeps ERP data injection, shimmer voice, executive prompt
- AZIN keeps translation-only prompt, alloy voice, faster VAD
- No backend changes needed

