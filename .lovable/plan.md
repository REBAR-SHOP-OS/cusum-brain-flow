

## Plan: Auto-Speak for Vizzy Intelligence Panel

### What Changes
Add auto-speak so every Vizzy assistant reply is automatically sent to PersonaPlex TTS and played aloud.

### Implementation

**1. Create `src/hooks/useVizzyAutoSpeak.ts`** — a small hook encapsulating the TTS logic:
- `audioRef` to track the single active `HTMLAudioElement`
- `speakText(text)` function that POSTs to `${VITE_TTS_API_URL}/v1/tts`, decodes `audio_base64`, creates a blob URL, and plays it
- Guards: skip empty text, `[UNCLEAR]`, and messages starting with `⚠️` / `❌` / `🚫` / `⏳` (system/error messages)
- Stops any currently playing audio before starting new playback
- Cleans up blob URLs on `ended`

**2. Patch `src/components/layout/IntelligencePanel.tsx`** — minimal addition:
- Import and call `useVizzyAutoSpeak()`
- Add a `useEffect` that watches `messages` and `isStreaming`: when streaming ends and the last message is `assistant`, call `speakText(lastMessage.content)`
- This ensures we speak only the final complete reply, not partial chunks

### Guards Against Overlap / Noise
- Single `audioRef` — old audio stopped before new plays
- No speak during streaming (waits for completion)
- Skip tool/system messages via prefix checks
- Skip empty or `[UNCLEAR]` content

### What Does NOT Change
- UI, styling, layout — untouched
- `useAdminChat` hook — untouched
- Manual playback if it exists elsewhere — preserved
- No database or edge function changes

### Files
| File | Action |
|------|--------|
| `src/hooks/useVizzyAutoSpeak.ts` | Create |
| `src/components/layout/IntelligencePanel.tsx` | Add hook + useEffect (≈10 lines) |

