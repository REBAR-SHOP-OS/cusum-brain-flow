

# Fix "WebSocket is not connected" Error in Vizzy Voice

## Root Cause

The ElevenLabs `useScribe` hook throws uncaught errors when:
1. `scribe.disconnect()` is called when WebSocket is already disconnected (in `pauseListening` and `endSession`)
2. `scribe.connect()` is called with an expired token (in `resumeListening`) — tokens expire after 15 minutes
3. These errors bubble up as uncaught exceptions because the try/catch blocks don't fully contain the async lifecycle of the Scribe SDK

## Fix — `src/hooks/useVizzyGeminiVoice.ts`

### 1. Guard `disconnect()` with `isConnected` check
Before calling `scribe.disconnect()`, check `scribe.isConnected` to avoid calling it when already disconnected.

- **`pauseListening`** (line 124): add `if (scribeRef.current.isConnected)` guard
- **`endSession`** (line 355): add `if (scribe.isConnected)` guard

### 2. Guard `connect()` with `isConnected` check
In `resumeListening` (line 97), only call `connect()` if `!scribeRef.current.isConnected`. This prevents double-connect attempts.

### 3. Always fetch a fresh token when resuming
Instead of reusing `scribeTokenRef.current` which may be expired, always fetch a new token in `resumeListening`. This eliminates the two-step retry logic (try old token → catch → fetch new token) and makes reconnection more reliable.

### 4. Add global unhandled rejection catcher (safety net)
Add a window-level handler in the voice chat component to suppress Scribe WebSocket errors that escape try/catch, preventing the toast/error overlay from showing.

## Scope
- 1 file modified: `src/hooks/useVizzyGeminiVoice.ts`
- No database or edge function changes

