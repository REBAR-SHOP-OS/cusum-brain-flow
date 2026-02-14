

# Add Mute Button + Keep Text Responses Visible in Voice Mode

## What Changes

Two improvements to the voice chat experience:

1. **Mute Button**: Add a mic mute/unmute toggle next to the VoiceOrb so the user can temporarily mute their mic without ending the conversation.
2. **Text responses always visible**: Currently voice mode hides the message area when the conversation is active. Change this so AI responses still appear as text bubbles in the chat scroll area, even during voice mode -- the orb and controls overlay at the bottom while messages scroll above.

## Changes

### 1. `src/hooks/useVoiceChat.ts` -- Add mute support

- Add `isMuted` state and `toggleMute` function.
- When muted: pause speech recognition (stop listening) but keep the conversation active (TTS continues, status transitions continue).
- When unmuted: restart speech recognition.
- Expose `isMuted` and `toggleMute` in the return object.
- When muted, silence detection should be disabled (no accidental sends).

### 2. `src/components/chat/VoiceOrb.tsx` -- Add mute button next to orb

- Add a smaller circular mute/unmute button beside the orb (using `MicOff` / `Mic` icons).
- When muted, show a crossed-out mic icon with a subtle red tint.
- The mute button only appears when the conversation is active (not idle).

### 3. `src/pages/LiveChat.tsx` -- Always show messages in voice mode

- Remove the condition that hides the message scroll area during voice mode. The `ScrollArea` with message bubbles will always be visible.
- The voice orb section renders as a fixed bottom panel overlaying beneath the messages, so the user sees both the text conversation and the voice controls.
- Pass `isMuted` and `toggleMute` from `voiceChat` to `VoiceOrb`.
- Remove the condition `!(voiceMode && voiceChat.isConversationActive)` that hides the text input -- instead just hide the text input bar when voice conversation is active, but keep messages visible above.

## Files to Modify

| Action | File |
|--------|------|
| Modify | `src/hooks/useVoiceChat.ts` -- add `isMuted` state, `toggleMute`, pause/resume mic |
| Modify | `src/components/chat/VoiceOrb.tsx` -- render mute button next to orb |
| Modify | `src/pages/LiveChat.tsx` -- always show messages, pass mute props |

