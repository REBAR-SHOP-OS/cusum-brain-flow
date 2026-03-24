

## Keep Voice-to-Text Active Until User Manually Stops

### Problem
When the speech recognition produces a final transcript, the `useEffect` in `MessageThread.tsx` calls `speech.reset()` to append text to input. But `reset()` internally calls `stop()`, which kills the recognition session. The user has to click the mic button again to restart.

### Changes

**File**: `src/hooks/useSpeechRecognition.ts`

Add a new method `clearTranscripts()` that clears accumulated transcripts and interim text **without stopping** the recognition:

```typescript
const clearTranscripts = useCallback(() => {
  setTranscripts([]);
  setInterimText("");
}, []);
```

Also remove the silence timeout auto-stop behavior — keep the `onSilenceEnd` callback available but don't auto-fire it (or just remove the silence timer entirely since the user wants manual control).

Add `clearTranscripts` to the return object.

**File**: `src/components/teamhub/MessageThread.tsx` (lines 224-234)

Replace `speech.reset()` with `speech.clearTranscripts()` so recognition keeps running:

```typescript
useEffect(() => {
  if (speech.fullTranscript) {
    setInput((prev) => {
      const space = prev && !prev.endsWith(" ") ? " " : "";
      return prev + space + speech.fullTranscript;
    });
    speech.clearTranscripts(); // Don't stop, just clear accumulated text
  }
}, [speech.fullTranscript]);
```

### Files Changed

| File | Change |
|---|---|
| `src/hooks/useSpeechRecognition.ts` | Add `clearTranscripts()` method that clears state without stopping recognition |
| `src/components/teamhub/MessageThread.tsx` | Use `clearTranscripts()` instead of `reset()` |

