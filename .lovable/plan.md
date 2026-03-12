

# Fix: Double Voiceover — Video Embedded Audio + Separate Audio Instance

## Problem

The `<video>` element plays with `muted={isMuted}`. AI-generated video clips from Veo/Sora often have the voiceover **baked into the video's audio track**. Meanwhile, the editor also creates a **separate `Audio()` instance** from the voiceover file and plays it simultaneously. Result: two copies of the voiceover playing at once.

## Solution

**Always mute the `<video>` element's native audio.** The editor manages all audio (voiceover + music) through dedicated `Audio` instances with sync, ducking, and volume control. The video's embedded audio should never play.

### Changes in `src/components/ad-director/ProVideoEditor.tsx`

1. **Video element**: Change `muted={isMuted}` to `muted` (always muted). The video tag becomes a visual-only player.

2. **`toggleMute` function**: Remove the line `videoRef.current.muted = !isMuted`. Muting/unmuting now only controls the separate voiceover `Audio` instance (which it already does via the `isMuted` state in the voiceover effect).

This is a one-line fix on the `<video>` tag and a one-line removal in `toggleMute`.

