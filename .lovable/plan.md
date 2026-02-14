

# Fix: Make Voice Chat Share the Same Conversation

## Problem

`useVoiceChat()` internally creates its own `useAdminChat()` hook instance. `LiveChat.tsx` also creates a separate `useAdminChat()`. This means voice mode and text mode have **two independent chat histories** that never see each other's messages.

## Solution

Refactor `useVoiceChat` to accept an existing `useAdminChat` instance as a parameter, so both voice and text mode operate on the **same** conversation thread.

## Changes

### `src/hooks/useVoiceChat.ts`
- Remove the internal `const chat = useAdminChat();` call
- Accept the chat instance as a parameter: `useVoiceChat(chat: ReturnType<typeof useAdminChat>)`
- Everything else (TTS, speech recognition, orb state machine) stays the same but now reads/writes the shared messages

### `src/pages/LiveChat.tsx`
- Pass the existing `useAdminChat()` result into `useVoiceChat(chat)`
- Remove the separate `activeMessages` / `activeIsStreaming` logic since both modes now use the same messages array
- Always show the same message thread regardless of voice/text toggle

## Technical Details

```text
Before:
  LiveChat
    useAdminChat() --> chat A (text mode messages)
    useVoiceChat()
      useAdminChat() --> chat B (voice mode messages, separate!)

After:
  LiveChat
    useAdminChat() --> chat (shared)
    useVoiceChat(chat) --> uses same chat instance
```

| Action | File |
|--------|------|
| Modify | `src/hooks/useVoiceChat.ts` -- accept chat as parameter instead of creating internal instance |
| Modify | `src/pages/LiveChat.tsx` -- pass shared chat instance, remove dual-message logic |

