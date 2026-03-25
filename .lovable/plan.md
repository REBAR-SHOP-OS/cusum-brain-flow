

## Build "Nila Voice Assistant" — Full-Featured Bilingual Voice App

### What
When the user taps the Nila avatar button on the interpreter page, a new full-screen dark-themed voice assistant opens instead of the current `AzinInterpreterVoiceChat`. This assistant has 3 modes (Normal chat, Silent, Translate), Gemini TTS, wave visualizer, i18n, and PDF export.

### Architecture

```text
┌─────────────────────────────────────┐
│  AzinInterpreter.tsx                │
│  (avatar click → NilaVoiceAssistant)│
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  NilaVoiceAssistant.tsx (overlay)   │
│  - Dark theme, glass effects        │
│  - 3 modes: normal/silent/translate  │
│  - Header + WaveVisualizer          │
│  - MicButton + ChatMessages         │
│  - VoiceSelector + TextInput        │
│  - PDF export                        │
├──────────────────────────────────────┤
│  useNilaVoiceAssistant.ts (hook)    │
│  - Web Speech API recognition       │
│  - Mode management (1/2/3)          │
│  - AI chat via edge function         │
│  - TTS queue via edge function       │
│  - i18n state                        │
└──────────────────────────────────────┘
```

### New Files

**1. `supabase/functions/nila-gemini-tts/index.ts`** — Edge function for Gemini TTS
- Uses Lovable AI Gateway with model `google/gemini-2.5-flash-lite` (Gemini TTS is not available via gateway, so we use ElevenLabs TTS which already exists)
- Actually: reuse the existing `elevenlabs-tts` edge function for TTS. The user requested Gemini TTS but that model (`gemini-2.5-flash-preview-tts`) is not available on the Lovable AI Gateway. We will use the existing ElevenLabs TTS with multiple voice options instead.

**2. `supabase/functions/nila-chat/index.ts`** — Edge function for AI chat (SSE streaming)
- Uses Lovable AI Gateway with `google/gemini-2.5-flash-lite`
- Two system prompts: normal mode (Persian assistant) and translate mode (strict translator)
- Accepts `mode`, `messages`, `lang` parameters
- Streams response via SSE
- max_tokens: 150 normal, 100 translate; temperature: 0.2 normal, 0 translate

**3. `src/hooks/useNilaVoiceAssistant.ts`** — Main hook
- Web Speech API with continuous=true, interimResults=true, language toggle (fa-IR/en-US)
- Mode state: `normal` (1), `silent` (2), `translate` (3); default: silent
- Mode command detection from speech/text input (recognizes 1/۱/یک/one etc.)
- In silent mode: only process mode commands, ignore everything else
- 800ms debounce on final results before sending
- AI chat: streams from `nila-chat` edge function, keeps last 4 messages as context
- TTS queue: splits response by sentence (. ؟ ! ؛), calls `elevenlabs-tts` per sentence, prefetch next while playing current
- 20-item audio cache (Map)
- Fallback to browser SpeechSynthesis on TTS error
- AudioContext playback at 24000Hz for raw PCM (or standard Audio element for MP3 from ElevenLabs)
- Status tracking: ready/listening/processing/speaking

**4. `src/components/nila/NilaVoiceAssistant.tsx`** — Main overlay component
- Full-screen dark overlay (bg hsl(230,15%,8%)) with ambient glow (two blurred circles)
- Glass/blur effects via backdrop-filter
- Sections: Header, WaveVisualizer, ChatMessages, MicButton, VoiceSelector, TextInput
- Vazirmatn font for Farsi, Inter for English
- RTL/LTR toggle with Globe button
- i18n system with localStorage persistence

**5. Sub-components (inside `src/components/nila/`):**
- `NilaHeader.tsx` — gradient title, status indicator (dot + text), mode badge, buttons (voice select, language, PDF)
- `NilaWaveVisualizer.tsx` — 32 animated vertical bars; listening=blue random, speaking=gradient sine wave, idle=2px
- `NilaMicButton.tsx` — 72px round button, Mic/MicOff icon, pulse rings (blue listening, purple speaking), glow shadow
- `NilaChatMessages.tsx` — scrollable message list; user (bg-secondary), assistant (glass+markdown via ReactMarkdown), system (glass+accent); fade-up animation
- `NilaVoiceSelector.tsx` — horizontal scrollable voice list (Kore, Puck, Charon, Aoede, Fenrir, Leda mapped to ElevenLabs voice IDs)
- `NilaTextInput.tsx` — glass-styled input at bottom, placeholder shows interim transcript, gradient send button

**6. `src/lib/nilaI18n.ts`** — i18n translations for FA/EN UI strings

### Changes to Existing Files

**`src/pages/AzinInterpreter.tsx`**
- Replace `showVoiceChat` state to open `NilaVoiceAssistant` instead of `AzinInterpreterVoiceChat`
- Import and render `NilaVoiceAssistant` in the AnimatePresence block

### Edge Function Details

**`nila-chat/index.ts`:**
- POST body: `{ messages: [{role, content}], mode: "normal"|"translate", lang: "fa"|"en" }`
- System prompts:
  - Normal: "تو یک دستیار فارسی هستی. کوتاه و دقیق جواب بده."
  - Translate: "Strict translator. Persian→English, English→Persian. Output ONLY the translation."
- Uses `stream: true` with Lovable AI Gateway
- Returns SSE stream directly

### PDF Report
- Uses existing `jsPDF` + `addMarkdownToPdf` pattern from the codebase
- Downloads conversation with role-based coloring (user=grey, assistant=blue, system=grey)
- RTL support via existing patterns

### Custom CSS
- Add glass classes and dark-theme keyframes to `src/index.css` or use inline Tailwind
- Animations: pulse-ring, float, fade-up, glow-pulse as Tailwind keyframes

### Files Summary

| File | Action |
|---|---|
| `supabase/functions/nila-chat/index.ts` | Create — AI chat edge function with streaming |
| `src/hooks/useNilaVoiceAssistant.ts` | Create — Main hook with speech, modes, TTS, chat |
| `src/components/nila/NilaVoiceAssistant.tsx` | Create — Full overlay component |
| `src/components/nila/NilaHeader.tsx` | Create — Header with status, mode, controls |
| `src/components/nila/NilaWaveVisualizer.tsx` | Create — 32-bar audio visualizer |
| `src/components/nila/NilaMicButton.tsx` | Create — Animated mic button |
| `src/components/nila/NilaChatMessages.tsx` | Create — Chat message list with markdown |
| `src/components/nila/NilaVoiceSelector.tsx` | Create — Voice picker |
| `src/components/nila/NilaTextInput.tsx` | Create — Glass text input |
| `src/lib/nilaI18n.ts` | Create — FA/EN translations |
| `src/pages/AzinInterpreter.tsx` | Modify — Wire avatar click to new component |
| Deploy `nila-chat` | Deploy edge function |

