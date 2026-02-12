

# Fix Double Greeting in AI Voice Bridge

## Root Cause

The "double agent" greeting happens because of a **race condition** between the ElevenLabs agent's dashboard-configured first message and the override sent from code:

1. WebSocket connects -> ElevenLabs server immediately starts speaking the agent's **dashboard-configured** first message
2. Code sends `conversation_initiation_client_data` with a **different** first message override
3. Both greetings fire, creating two overlapping AI voices

## Two-Part Fix

### Part 1: Dashboard Change (you need to do this manually)

Go to the ElevenLabs dashboard for the **phone agent** (`ELEVENLABS_PHONE_AGENT_ID`):
- Set "First message" to **empty/blank**
- Ensure "Allow client overrides" is **enabled**

This ensures the agent waits for the client override instead of speaking immediately.

### Part 2: Code Change - Wait for Server Confirmation Before Streaming

Instead of the arbitrary 300ms delay, wait for the `conversation_initiation_metadata` event from ElevenLabs (which confirms overrides were received) before starting audio capture. This eliminates the race.

**File: `src/hooks/useCallAiBridge.ts`**

- Replace the `setTimeout(() => { ... }, 300)` block with a flag-based approach
- In `ws.onopen`: send overrides, but do NOT start audio yet
- In `handleWsMessage` for `conversation_initiation_metadata`: trigger audio start (attach `onaudioprocess`, replace track, mute RC element)
- Store the setup function in a ref so `handleWsMessage` can call it when ready

```
// In ws.onopen:
ws.send(overrides);  // send immediately
// Do NOT start audio here -- wait for server confirmation

// In handleWsMessage, case "conversation_initiation_metadata":
// NOW start audio capture + replace track + mute RC element
startAudioCapture();
```

This guarantees the override is registered before any audio flows in either direction.

## Technical Details

- Add a `startAudioRef` callback ref that holds the function to begin audio capture
- `ws.onopen` sets up this callback but doesn't invoke it
- `handleWsMessage` invokes it on `conversation_initiation_metadata`
- Add a 3-second safety timeout in case the metadata event never arrives
- Pass `callSession` references through to `handleWsMessage` via closure or ref

## Expected Result

- Only ONE AI greeting (the override) is heard by the caller
- No audio is sent to ElevenLabs until the server confirms it received the override
- Eliminates the race condition entirely

