

## Add Mute Button to Vizzy Voice Chat

### What's Missing

The voice engine (`useVoiceEngine.ts`) has no mute/unmute capability. The `VizzyVoiceChat` UI has no mute button — users can only end the session entirely.

### Plan

**1. Add mute toggle to `useVoiceEngine.ts`**
- Add `isMuted` state (boolean, default false)
- Add `toggleMute` callback that enables/disables all audio tracks on `streamRef.current`
- Return `isMuted` and `toggleMute` from the hook

**2. Expose mute through `useVizzyVoiceEngine.ts`**
- Pass `isMuted` and `toggleMute` through from the underlying engine return

**3. Add mute button to `VizzyVoiceChat.tsx` UI**
- Place a mute/unmute toggle button next to the "End Session" button in the bottom controls
- Use `Mic`/`MicOff` icons with the teal theme styling (muted state gets a dimmed/strikethrough look)
- Show visual feedback: when muted, the "Listening..." status changes to "Muted" and the audio wave bars stop

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useVoiceEngine.ts` | Add `isMuted` state, `toggleMute` function, return both |
| `src/hooks/useVizzyVoiceEngine.ts` | Pass through `isMuted` and `toggleMute` |
| `src/components/vizzy/VizzyVoiceChat.tsx` | Add mute button in bottom controls, update status text when muted |

