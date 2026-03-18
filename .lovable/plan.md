

## Plan: Add Live AI Voice Chat to AZIN Page

### Problem
The avatar icon in the AZIN interpreter header currently does nothing. The user wants it to launch a live voice conversation with AI, styled like ChatGPT's voice mode (animated orb icon).

### Approach
The project already has a fully working live voice chat system (`VizzyVoiceChat` + `useVizzyVoice`) that uses ElevenLabs Conversational AI (which connects to an AI agent that can use GPT as its LLM). We will reuse this infrastructure and add it to the AZIN page.

### Changes

**1. `src/pages/AzinInterpreter.tsx`**
- Import `VizzyVoiceChat` and AZIN avatar image
- Add a state `showVoiceChat` toggled by clicking the avatar icon in the header
- Replace the current header icons area with a ChatGPT-style animated orb button (concentric circles animation when idle, pulsing when active)
- When clicked, show the `VizzyVoiceChat` fullscreen overlay (same as existing Vizzy voice chat)

**2. New: `src/components/azin/AzinVoiceChatButton.tsx`**
- A ChatGPT-style animated voice button component
- Concentric animated rings (like ChatGPT's live voice icon)
- Uses the AZIN avatar in the center
- Clicking opens the voice chat overlay

### Visual Design
The button will have:
- Circular avatar in center (AZIN's curly-hair girl)
- Animated concentric rings radiating outward (ChatGPT voice mode style)
- Teal/primary color scheme matching the page
- Subtle pulse animation when idle

### Files to modify
- `src/pages/AzinInterpreter.tsx` — add voice chat toggle + overlay
- `src/components/azin/AzinVoiceChatButton.tsx` — new ChatGPT-style animated button

