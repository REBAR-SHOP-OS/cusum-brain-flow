

# Best Farsi Voice for Vizzy -- Custom Voice Pipeline

## The Problem
ElevenLabs doesn't have native Persian/Farsi voices. Their multilingual model can attempt Farsi but with a non-native accent.

## The Solution: Hybrid Voice Mode
Build a dedicated **Farsi voice mode** that bypasses ElevenLabs entirely and uses:

1. **Browser Speech Recognition** (Web Speech API) -- Free, built-in, works great for Farsi on Chrome
2. **Gemini 3 Pro** (via Lovable AI) -- Already powering Vizzy's text brain, excellent at Farsi
3. **Browser Speech Synthesis** (Web Speech API) -- Chrome ships with Google's high-quality Farsi voice ("Google fارسی")

This gives you a fully native Farsi voice experience with zero extra API costs.

## How It Works

When user's `preferred_language` is `fa` (or they select Farsi mode), Vizzy switches from ElevenLabs to the custom pipeline:

```text
User speaks Farsi
    --> Browser SpeechRecognition (fa-IR) transcribes
    --> Send text to admin-chat edge function (Gemini)
    --> Gemini responds in Tehrani Farsi
    --> Browser SpeechSynthesis reads response in Farsi voice
    --> Transcript shown in RTL in the UI
```

## Changes

### 1. New Hook: `src/hooks/useVizzyFarsiVoice.ts`
A custom voice pipeline hook that:
- Uses `webkitSpeechRecognition` with `lang: "fa-IR"` for continuous listening
- Sends transcribed text to `admin-chat` edge function (already has full Tehrani Farsi instructions)
- Uses `SpeechSynthesis` with a Persian voice to speak responses
- Exposes the same interface as the ElevenLabs `useConversation` hook (status, transcript, start/stop, mute)
- Falls back to English ElevenLabs if browser doesn't support Farsi speech

### 2. Update `src/pages/VizzyPage.tsx`
- Detect `preferredLang === "fa"` from the token response
- If Farsi, use `useVizzyFarsiVoice` instead of `useConversation`
- Same UI, same transcript display, same client tools -- just different audio engine
- Add a language toggle button so user can switch mid-session

### 3. No Edge Function Changes Needed
- `admin-chat` already has full Tehrani Farsi instructions
- `elevenlabs-conversation-token` still used for English mode
- Business context loading stays the same

## Technical Details

### Browser Speech Recognition (STT)
```text
const recognition = new webkitSpeechRecognition();
recognition.lang = "fa-IR";
recognition.continuous = true;
recognition.interimResults = true;
```
- Works on Chrome, Edge, Safari (most browsers)
- Free, no API key needed
- Good accuracy for conversational Farsi

### Browser Speech Synthesis (TTS)
```text
const utterance = new SpeechSynthesisUtterance(text);
utterance.lang = "fa-IR";
// Chrome provides "Google fارسی" voice automatically
```
- Uses Google's neural Farsi voice on Chrome
- Natural-sounding, native accent
- Free, no API key needed

### Fallback Strategy
If the browser doesn't have Farsi speech capabilities:
- Show a toast: "Farsi voice not available on this browser, using text-only mode"
- Fall back to text chat with Farsi responses displayed in RTL

### Files to Create/Modify
1. **Create** `src/hooks/useVizzyFarsiVoice.ts` -- New Farsi voice pipeline hook
2. **Modify** `src/pages/VizzyPage.tsx` -- Add language detection and hook switching
3. **Modify** `src/pages/LiveChat.tsx` -- Add Farsi voice option for text chat voice button

