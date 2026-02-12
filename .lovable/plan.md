

# Fix: AI Goes Silent After Greeting

## Root Cause

After the AI delivers its greeting, the microphone capture is suppressed for too long and the caller's response is never heard by the AI. Here is what happens:

1. The AI greeting plays as many small audio chunks (each one resets the 2500ms echo tail timer)
2. After the last chunk finishes, the mic stays muted for another 2500ms
3. The caller responds during this muted window -- their speech is discarded
4. ElevenLabs never receives caller audio, so the AI has nothing to respond to
5. The conversation dies

## Solution

Two changes to `src/hooks/useCallAiBridge.ts`:

### 1. Reduce the echo tail guard from 2500ms to 800ms

The 2500ms guard was too aggressive. Telephony echo typically fades within 300-500ms. An 800ms guard is sufficient to catch echo while letting the caller's response through quickly.

### 2. Lower the energy gate threshold from 0.01 to 0.005

Phone audio from a remote caller can be quieter than local microphone input, especially on mobile networks. The 0.01 threshold may be filtering out legitimate speech. Lowering to 0.005 catches more real speech while still filtering dead silence.

## Technical Details

**File: `src/hooks/useCallAiBridge.ts`**

Change 1 -- Echo tail guard (line ~364):
```text
// Before:
setTimeout(() => { ... ttsPlayingRef.current = false; }, 2500);

// After:
setTimeout(() => { ... ttsPlayingRef.current = false; }, 800);
```

Change 2 -- Energy gate threshold (line ~135):
```text
// Before:
if (rms < 0.01) return;

// After:
if (rms < 0.005) return;
```

## Expected Outcome

- After the AI greeting finishes, the mic unmutes within ~800ms instead of ~2500ms
- The caller's response ("Yes, it's me") is captured and sent to ElevenLabs
- The conversation continues naturally after the greeting

