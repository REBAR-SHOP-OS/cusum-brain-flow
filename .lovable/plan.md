

# Root-Cause Audit: Voice Glitches, VO/Video Mismatch, and Design Polish

## Problem Summary

The voiceover is often **longer than the video clip**, causing it to get cut when scenes advance. The playback rate cap (1.6x) isn't enough for extreme mismatches. The system lacks a fundamental guardrail: **matching voiceover duration to clip duration at generation time**.

## Root Causes

### 1. No duration coordination between TTS and video generation
- Video clips are generated at fixed durations (5s, 10s, 15s depending on provider)
- Voiceovers are generated from script text with no duration constraint
- A 6-second script segment might produce a 7s voiceover but only a 5s video clip
- The 1.6x speedup cap can only compensate for ~60% mismatch (5s clip can handle up to 8s VO)
- Beyond that, the VO gets cut or sounds unnaturally fast

### 2. Voiceover starts before video is ready
- The 50ms debounce fires the VO immediately, but the video may still be buffering
- Result: VO plays 200-500ms ahead of the video, creating perceived desync

### 3. Scene advance destroys audio mid-sentence
- `advanceToNextScene` checks `audioRef.current.paused` but the `onended` callback races with the cleanup effect
- If `selectedSceneIndex` changes before `onended` fires, cleanup kills the audio

### 4. No preloading of next scene's voiceover
- Each scene change creates a new `Audio()` from scratch, adding loading latency

## Solution

### A. Match voiceover speed to clip duration dynamically (fix the root cause)

In the TTS generation step (`generateAllVoiceovers`), after measuring VO duration, if `voDur > clipDur`, use ElevenLabs' `speed` parameter (0.7-1.2) to regenerate a tighter VO. If still too long, apply playback rate adjustment. This two-pass approach ensures the VO fits the clip naturally.

**Changes in `ProVideoEditor.tsx` — `generateAllVoiceovers` function (lines 728-775):**
- After measuring VO duration, compare against clip duration
- If VO is >20% longer than clip, regenerate with ElevenLabs `speed: 1.15` parameter
- Store the ratio and apply remaining speedup via `playbackRate` (max 1.3x)

### B. Sync voiceover start to video `playing` event

**Changes in playback effect (lines 272-305):**
- For video scenes, don't start VO in the debounce timer
- Instead, listen for the `playing` event on `videoRef.current`
- Start VO only when video actually begins playing
- This eliminates the startup desync gap

### C. Protect audio across scene transitions

**Changes in `advanceToNextScene` (lines 635-690):**
- Before setting `selectedSceneIndex`, detach `audioRef.current` from the ref and let it finish naturally via `onended`
- The cleanup effect won't destroy it because `audioRef.current` is already `null`
- The orphaned Audio instance plays to completion, then self-disposes

### D. Preload next scene's voiceover

**New logic after scene advance decision:**
- When current scene is >70% through, preload the next scene's VO URL via `new Audio(nextVoUrl)` without playing
- On scene change, swap to the preloaded instance instead of creating from scratch

### E. Design polish — Creative Brief glassmorphism and font

**Changes in `ScriptInput.tsx` (lines 130-150):**
- Apply `font-[Space_Grotesk]` to the textarea
- Add glassmorphism to the Creative Brief card: `bg-card/30 backdrop-blur-xl border border-white/[0.08] rounded-2xl`
- Style the word count / duration badges with glass pill treatment

**Changes in `ScriptInput.tsx` brand kit card (lines 152-160):**
- Enhance glassmorphism: `bg-white/[0.03] backdrop-blur-xl`

### Concrete File Changes

**`src/components/ad-director/ProVideoEditor.tsx`:**
1. Playback effect: sync VO start to video `playing` event
2. `advanceToNextScene`: orphan the audio ref before changing scene index
3. `generateAllVoiceovers`: add speed parameter for long VOs, two-pass fitting
4. Add VO preloading for next scene

**`src/components/ad-director/ScriptInput.tsx`:**
1. Glassmorphism on Creative Brief card and textarea container
2. Space Grotesk font on textarea
3. Glass pill badges

**`supabase/functions/elevenlabs-tts/index.ts`:**
1. Accept optional `speed` parameter (0.7-1.2) and pass to ElevenLabs API

