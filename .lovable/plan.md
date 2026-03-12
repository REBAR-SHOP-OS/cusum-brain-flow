

# Add Automatic Transitions and Audio-Video Balancing

## Problems
1. **No transitions** — clips cut abruptly from one to the next with hard cuts
2. **Audio-video sync issues** — voiceover audio per-scene plays independently without duration matching; music volume doesn't duck under voiceover
3. **No crossfade/dissolve** between scenes in the final export

## Changes

### 1. Crossfade transitions in `videoStitch.ts`
Add a configurable crossfade (0.5s default) between clips during canvas rendering:
- During the last 0.5s of each clip, start preloading and drawing the next clip with increasing opacity
- Use `ctx.globalAlpha` to blend: outgoing clip fades from 1→0, incoming clip fades from 0→1
- First clip has no fade-in (clean start), last clip has no fade-out (clean end to endcard)

### 2. Audio ducking and balancing in `videoStitch.ts`
- When voiceover is present, automatically duck music volume to 15% (from 30%)
- Normalize voiceover gain based on scene duration vs audio duration — if VO is longer than scene, slightly increase playback rate; if shorter, pad with silence
- Add a master limiter gain node to prevent clipping when mixing voice + music

### 3. Per-scene voiceover sync in `ProVideoEditor.tsx`
- When playing voiceover during preview, sync audio currentTime to video currentTime
- Add `timeupdate` listener on video to keep audio in lockstep

### 4. Smooth transition preview in editor
- During auto-advance (`handleVideoEnded`), add a brief CSS opacity transition on the video element for visual smoothness in the preview

## Files to modify

### `src/lib/videoStitch.ts`
- Add `crossfadeDuration` option to `StitchOverlayOptions` (default 0.5s)
- In `playNextClip`, overlap the last N frames of current clip with first N frames of next clip using alpha blending
- Preload next clip's first frame while current clip plays its final frames
- Add audio ducking: when voice audio is active, reduce music gain to 0.15
- Add gain normalization to prevent audio clipping

### `src/components/ad-director/ProVideoEditor.tsx`
- Update voiceover sync `useEffect` to track video time and sync audio position
- Add CSS transition class to video element during scene changes
- Pass `crossfadeDuration: 0.5` in stitch overlay options when exporting

## Technical approach for crossfade

```text
Clip A:  [============|--fade--|]
Clip B:              [|--fade--|============]
                      ^overlap^

During overlap:
  frame: draw clipA at alpha=(1 - progress)
         draw clipB at alpha=progress
  where progress = (currentTime - fadeStart) / crossfadeDuration
```

The crossfade is implemented in the canvas render loop. The next clip's video element is pre-seeked to time 0 and ready before the fade begins. Both video elements play simultaneously during the overlap period.

## Audio balancing approach

```text
Voice:  [====VO1====]  [====VO2====]  [===VO3===]
Music:  [vol:0.15...] [vol:0.15...] [vol:0.15.] [vol:0.3 (no VO)]
```

- GainNode for music dynamically adjusts: 0.15 when VO plays, 0.3 during gaps
- A DynamicsCompressorNode on the master output prevents clipping
- Voice gain stays at 1.0 (primary audio)

