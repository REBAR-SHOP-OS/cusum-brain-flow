

# Add Prominent Voice Chat Button to Input Area

## Problem

The voice mode toggle is a small headset icon buried in the header bar. Users don't notice it. There's no voice button in the input area where they naturally interact.

## Solution

Add a prominent **microphone button** directly in the input toolbar (next to the send button) that immediately starts the voice conversation loop when tapped -- no need to first toggle "voice mode" via the header.

## Changes

### `src/pages/LiveChat.tsx`

1. Add a **Mic button** in the input toolbar (bottom bar, next to the Send button) that:
   - When tapped: enables `voiceMode` and calls `voiceChat.handleOrbTap()` to immediately start the conversation loop
   - Visually: a microphone icon button, same size as the Send button, placed to the left of Send
   
2. Keep the header headset icon as a secondary toggle, but the primary entry point is now in the input area

3. When voice conversation is active, the input area is already hidden (existing logic) and replaced by the VoiceOrb -- this flow stays the same

### Visual layout of input toolbar (after change)

```text
[ emoji | mic-input | templates | formatting | commands ]  ...spacer...  [ MIC-BUTTON | SEND ]
```

The new Mic button will use the `Mic` icon from lucide-react, styled with a distinct color to stand out.

### Technical Details

- Import `Mic` from `lucide-react`
- Add a new button before the Send button in the input toolbar
- On click: `setVoiceMode(true)` then on next tick call `voiceChat.handleOrbTap()` to start listening immediately
- Button is hidden when `isStreaming` is true (same as send button behavior)

| Action | File |
|--------|------|
| Modify | `src/pages/LiveChat.tsx` -- add Mic button in input toolbar next to Send |

