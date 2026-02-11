

## Fix: Make Vizzy Actually Stay Silent

### Problem
Setting volume to 0 and sending one contextual update isn't enough. The ElevenLabs agent treats contextual updates as suggestions, not commands. It keeps generating speech (just muted), and its idle-detection logic prompts it to check in with "Sattar, are you there?" because it thinks you stopped talking.

### Solution -- Three-Layer Silence Enforcement

1. **Repeated contextual reinforcement**: Every time Vizzy generates an `agent_response` while in silent mode, immediately send another contextual update reminding her to stay silent. This prevents drift.

2. **User activity pings**: Start a periodic timer (every 15 seconds) that calls `conversation.sendUserActivity()` during silent mode. This tells the ElevenLabs system the user is still engaged, preventing the "are you there?" idle prompts.

3. **Stronger contextual update wording**: Make the instruction more forceful and explicit about not checking in.

### Technical Details

**File: `src/pages/VizzyPage.tsx`**

- Add a `silentIntervalRef` to hold the periodic activity ping timer
- When silent mode activates:
  - Start a `setInterval` every 15s calling `conversation.sendUserActivity()`
  - Send stronger contextual update: *"SYSTEM OVERRIDE: CEO activated silent mode. You MUST NOT speak, respond, or check in. Do NOT ask if they are there. Remain completely silent. Only speak when CEO says your name 'Vizzy'."*
- In the `agent_response` handler: if `silentMode` is true, immediately send another contextual update reinforcing silence
- When silent mode deactivates: clear the activity ping interval
- On unmount/session end: clear the interval
