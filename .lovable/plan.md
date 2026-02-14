

# Remove Farsi Mode — Make Vizzy English-Only

## Overview

Strip all Farsi/multilingual voice logic from VizzyPage and the system prompt. Vizzy will be English-only again, using ElevenLabs exclusively (no browser SpeechRecognition/SpeechSynthesis fallback).

## Changes

### File 1: `src/pages/VizzyPage.tsx`

| What | Detail |
|------|--------|
| Remove import | `useVizzyFarsiVoice` import (line 4) and `Languages` icon (line 3) |
| Remove state | `preferredLang`, `useFarsiMode` (lines 77-78) |
| Remove hook call | `farsiVoice = useVizzyFarsiVoice(...)` block (lines 81-97) |
| Remove Farsi branch | The `if (detectedLang === "fa")` block in auto-start (lines 475-492) — just skip straight to ElevenLabs |
| Simplify `stop` | Remove `useFarsiMode` conditional — always call `conversation.endSession()` (lines 440-444) |
| Simplify `isSpeakingNow` | Always use `conversation.isSpeaking` (line 581) |
| Simplify `statusLabel` | Remove all Farsi ternaries — English strings only (lines 583-593) |
| Remove language badge | The `preferredLang !== "en"` badge (lines 648-652) |
| Remove Farsi interim text | The `farsiVoice.interimText` block (lines 659-664) |
| Remove `dir="rtl"` | On status label (line 653) |
| Simplify mute button | Remove `useFarsiMode` conditional — always use `setMuted` (lines 783-798) |
| Remove Language toggle button | The entire Languages button (lines 801-818) |

### File 2: `src/lib/vizzyContext.ts`

Replace the multilingual/Farsi instructions (lines 54-57) with a simple English-only directive:

```
YOU ARE VIZZY — the CEO's personal AI assistant (like Jarvis for Iron Man).
You ALWAYS respond in English.
You have FULL access to live business data. Use ONLY these numbers. NEVER make up figures.
```

### File 3: `src/hooks/useVizzyFarsiVoice.ts`

No deletion needed — just removing all imports/usage. The file becomes dead code and can optionally be deleted for cleanup.

## What stays unchanged

- ElevenLabs voice pipeline (WebRTC + WebSocket fallback)
- All business context, tools, RingCentral integration
- Transcribe view's Farsi option (that's a separate feature for audio transcription, not Vizzy voice)
- The `autoFallbackAttemptedRef` fix for reconnection loops

