

# Fix "Speech recognition error: aborted" Toast

## Problem

When the voice chat stops listening (e.g., after detecting silence and sending a message), the browser fires an `aborted` error event on the SpeechRecognition instance. This is normal and expected, but the error handler treats it as a real error and shows a red toast notification.

## Solution

Add `"aborted"` to the handled error cases in `useSpeechRecognition.ts` so it is silently ignored instead of surfacing to the user.

## Changes

### `src/hooks/useSpeechRecognition.ts`

In the `recognition.onerror` handler (around line 95-106), add a check for `event.error === "aborted"` that simply returns without showing any error -- this is expected when recognition is programmatically stopped.

```typescript
// Add before the generic fallback:
} else if (event.error === "aborted") {
  // Expected when recognition is stopped programmatically -- ignore
  return;
}
```

| Action | File |
|--------|------|
| Modify | `src/hooks/useSpeechRecognition.ts` -- ignore "aborted" error |

