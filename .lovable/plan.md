
## Fix: Vizzy ElevenLabs SDK Error on CEO Portal

### Problem
The ElevenLabs `@elevenlabs/react` SDK fires an internal error event where it tries to read `error_type` from an undefined object. This happens inside the SDK's `handleErrorEvent` method before it reaches the `onError` callback in `VoiceVizzy.tsx`. The `VoiceVizzy` component is mounted globally via `AppLayout.tsx`, so the error appears on every page including `/ceo`.

### Root Cause
The `useConversation` hook from `@elevenlabs/react` initializes a WebSocket/WebRTC connection handler that listens for error events. When no active session exists, certain internal messages arrive with undefined payloads, causing the SDK to crash on `error_type` access.

### Solution

**1. Wrap `VoiceVizzy` in the SmartErrorBoundary (component-level)**  
In `src/components/layout/AppLayout.tsx`, wrap `<VoiceVizzy />` with `<SmartErrorBoundary level="component">` so SDK crashes are contained and don't bubble up as unhandled rejections.

**2. Guard `useConversation` initialization**  
In `src/components/vizzy/VoiceVizzy.tsx`, defer calling `useConversation()` until the user is actually the allowed user (`sattar@rebar.shop`). Currently, the hook initializes for ALL users, which triggers SDK internals even when Vizzy won't be used.

**3. Suppress the specific unhandled rejection**  
In `src/hooks/useGlobalErrorHandler.ts`, add `"error_type"` to the `isIgnoredError` list so this known SDK bug doesn't show a toast to the user.

### Technical Details

- **File: `src/components/layout/AppLayout.tsx`**  
  Import `SmartErrorBoundary`, wrap `<VoiceVizzy />`:
  ```tsx
  <SmartErrorBoundary level="component" maxAutoRetries={1}>
    <VoiceVizzy />
  </SmartErrorBoundary>
  ```

- **File: `src/components/vizzy/VoiceVizzy.tsx`**  
  Move the allowed-email gate above `useConversation` by splitting into two components: an outer gate component and an inner component that only mounts (and thus only calls `useConversation`) when the user is authorized.

- **File: `src/hooks/useGlobalErrorHandler.ts`**  
  Add `"error_type"` to the ignored error patterns array.
