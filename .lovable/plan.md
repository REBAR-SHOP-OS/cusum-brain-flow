

# Vizzy Voice — Production Hardening & UX Refinement

## Scope

Single file rewrite: `src/pages/VizzyVoice.tsx`. No backend changes — the `vizzy-voice` edge function is solid and read-only. Route is already login-protected.

## Changes

### 1. Voice Quality & Controls

- **Voice selector dropdown** — enumerate `speechSynthesis.getVoices()`, listen for `voiceschanged`, auto-select best English natural voice
- **Rate slider** (0.5–2.0, default 0.95) and **Pitch slider** (0.5–1.5, default 1.05)
- **Persist** selected voice URI, rate, and pitch in `localStorage`
- **Test Voice button** routes through the same TTS path with stored settings
- **Interrupt on mic tap** — if speaking, cancel `speechSynthesis` immediately before starting recognition

### 2. UX & Internal Tool Polish

- Header: **VIZZY** / Rebar Shop Voice Assistant
- Footer: "Internal ERP Tool · Read-Only · PersonaPlex"
- **5 status states** with distinct visuals: `idle`, `listening`, `processing`, `speaking`, `error`
- Larger transcript/reply panels with clear labels and timestamps
- **Copy reply** button (clipboard API)
- **Retry last query** button
- **Quick action chips**: "How many orders?", "Latest orders", "How many customers?", "How many leads?", "How many machines?", "How many cut plans?"
- Typed text input remains prominent below mic

### 3. Reliability & Safety Guardrails

- UI disclaimer banner: "Answers from internal ERP data only · Read-only · No actions performed"
- If backend returns the fallback message, display it with an amber "ungrounded" indicator
- Error state shown clearly with retry option
- No simulated actions — UI is purely display

### 4. Collapsible Voice Settings

- Voice controls (selector, rate, pitch) in a collapsible `<details>` panel labeled "Voice Settings" — keeps the main view clean

## Technical Details

- All changes in one file: `src/pages/VizzyVoice.tsx`
- Uses existing shadcn components (`Select`, `Slider`, `Button`) where available
- `localStorage` keys: `vizzy-voice-uri`, `vizzy-voice-rate`, `vizzy-voice-pitch`
- No new dependencies
- No backend changes
- No database changes

