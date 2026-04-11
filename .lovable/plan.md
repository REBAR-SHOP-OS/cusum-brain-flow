

# Update: Vizzy Voice — Natural Voice Quality Controls

## What Changes
Add voice selection, rate/pitch controls, test-speak button, and smart auto-selection to `src/pages/VizzyVoice.tsx`. No backend or routing changes.

## Implementation

### 1. Voice State & Initialization
- Add state: `voices`, `selectedVoiceURI`, `rate` (default 0.95), `pitch` (default 1.05)
- On mount, listen for `speechSynthesis.onvoiceschanged`, populate voice list
- Auto-select best voice: prefer voices with names containing "Google", "Natural", "Enhanced", "Premium" among `en` voices; fall back to first English voice, then default
- Load/persist `selectedVoiceURI`, `rate`, `pitch` from/to `localStorage` under keys `vizzy-voice-uri`, `vizzy-rate`, `vizzy-pitch`

### 2. Voice Controls UI (collapsible section below transcript area)
- **Voice dropdown** (`<select>`): lists all available `SpeechSynthesisVoice` entries, grouped by language, showing name + lang
- **Rate slider**: 0.5–1.5, step 0.05, default 0.95
- **Pitch slider**: 0.5–1.5, step 0.05, default 1.05
- **Test button**: speaks "Hello, I'm Vizzy, your rebar shop assistant" with current settings
- Styled consistently: muted borders, small text, compact layout

### 3. Apply Voice to TTS
- In `sendToVizzy`, set `utter.voice`, `utter.rate`, `utter.pitch` from state before calling `speak()`

### 4. Auto-Select Logic
```text
1. Get all voices
2. Filter to lang starting with "en"
3. Score: +10 "Natural/Enhanced/Premium", +5 "Google", +3 localService=false (cloud)
4. Pick highest score, or first en voice, or first voice
5. If localStorage has a saved URI that exists in list, use that instead
```

## Files Changed
- `src/pages/VizzyVoice.tsx` — ~80 lines added (state, useEffect, controls UI, voice application)

## Scope
- 1 file, frontend only
- No database or edge function changes

