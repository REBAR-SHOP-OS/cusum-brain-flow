

## Fix: Vizzy Disappearing After Connecting

### What's Happening
When you tap the mic button, Vizzy connects and shows the full-screen listening view. But the WebSocket connection drops almost immediately (network instability or SDK issue), and Vizzy silently vanishes back to just the mic button with no explanation.

### What We'll Fix

**1. Add a "connection lost" state instead of silently disappearing**
- When the connection drops unexpectedly (no user action), show a visible "Connection lost" message with a retry button instead of just hiding everything.

**2. Add automatic retry on unexpected disconnect**
- If Vizzy was connected and the connection drops (not stopped by the user), automatically attempt to reconnect up to 2 times before showing the "connection lost" state.

**3. Better disconnect tracking**
- Track whether the user intentionally stopped vs the connection dropped, so we handle each case differently.

### Technical Details

**File: `src/components/vizzy/VoiceVizzy.tsx`**

Add state tracking:
- `userRequestedStop` ref -- set to `true` only when user clicks the X button
- `connectionLost` state -- shown when connection drops unexpectedly after retries exhausted  
- `retryCount` ref -- tracks auto-reconnect attempts (max 2)

Modify `onDisconnect`:
- If `userRequestedStop` is false and retries remain, automatically call `start()` again after a 2-second delay
- If retries exhausted, set `connectionLost = true` to show a "Connection lost, tap to retry" UI

Modify `stop()`:
- Set `userRequestedStop.current = true` before calling `endSession()`

Add new UI state:
- When `connectionLost` is true, show a fixed-position card with "Connection lost" message and a "Try Again" button instead of just the mic button

Modify `start()`:
- Reset `userRequestedStop` and `connectionLost` on fresh start

This ensures Vizzy never silently vanishes -- the user always sees either the active session, a "reconnecting..." state, or a clear "connection lost" message with a retry option.
