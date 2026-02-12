

# Fix: AI Starts Before Answer + Echo/Overlap Issues

## Problems Identified

### 1. AI starts talking before the caller answers
The RingCentral WebPhone SDK has a **known limitation**: for outbound calls, the "answered" event fires immediately when the SIP INVITE is sent, NOT when the remote party picks up. This means the AI bridge activates while the phone is still ringing, causing the AI to "speak into the void" and hear ringback tone as caller audio.

### 2. Echo feedback loop causing overlap
When the AI speaks, its audio is sent to the remote party via the replaced WebRTC track. The telephony network echoes some of that audio back. The 1000ms echo tail guard is not long enough for telephony echo, causing the AI's own speech to be captured and sent back to ElevenLabs as "caller speech." This creates a feedback loop where the AI thinks the caller said something, interrupts itself, and then repeats.

## Solution

### Fix 1: Delay AI bridge start with a "ring guard" timer
Since the SDK cannot detect when the remote party actually answers, we add a configurable delay (e.g., 8 seconds) before starting the AI bridge. This gives the phone time to ring and be answered before the AI starts speaking.

**File: `src/components/accounting/PennyCallCard.tsx`**
- Add a delay timer in the auto-trigger `useEffect`
- When `callStatus` becomes `"in_call"`, start a timeout (e.g., 8 seconds) before calling `onStartAiBridge`
- Clear the timeout if the call ends before the timer fires
- Show a "Waiting for answer..." indicator during the delay

### Fix 2: Increase echo tail guard
**File: `src/hooks/useCallAiBridge.ts`**
- Increase the echo tail guard from 1000ms to 2500ms in `playAiAudioChunk`
- Telephony networks have longer echo tails than local audio, especially over PSTN

### Fix 3: Add audio energy gate to capture
**File: `src/hooks/useCallAiBridge.ts`**
- Add a simple energy threshold check in the `onaudioprocess` callback
- Only send audio chunks to ElevenLabs if the audio energy exceeds a minimum threshold
- This filters out low-level echo/noise that gets past the mute guard
- Threshold should be tunable (e.g., RMS > 0.01)

## Technical Details

### PennyCallCard.tsx -- Ring guard delay

```text
// Current behavior:
callStatus === "in_call" --> immediately starts AI bridge

// New behavior:
callStatus === "in_call" --> starts 8-second timer --> then starts AI bridge
callStatus changes away from "in_call" --> clears timer
```

The delay value of 8 seconds accounts for typical ring time (phones ring 4-6 times before someone answers). This can be adjusted based on real-world usage.

### useCallAiBridge.ts -- Echo tail guard increase

```text
// Current: 1000ms echo tail
setTimeout(() => { ttsPlayingRef.current = false; }, 1000);

// New: 2500ms echo tail for telephony
setTimeout(() => { ttsPlayingRef.current = false; }, 2500);
```

### useCallAiBridge.ts -- Audio energy gate

```text
// In onaudioprocess callback, before sending to ElevenLabs:
// Calculate RMS energy of the audio buffer
// If RMS < 0.01, skip sending (it's likely echo or silence)
```

## Files Modified

- `src/components/accounting/PennyCallCard.tsx` -- Ring guard delay before AI activation
- `src/hooks/useCallAiBridge.ts` -- Echo tail guard increase + audio energy gate

## Expected Outcome

- AI waits ~8 seconds after dialing before starting to speak, giving the caller time to answer
- Echo from telephony network is filtered out by longer tail guard and energy gate
- AI no longer hears its own speech echoed back as "caller audio"
- The "Caller: ..." empty entries in the transcript should disappear

