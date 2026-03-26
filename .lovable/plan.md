

# Speed Up Video Generation Pipeline

## Problem
Video generation is slow because scenes are generated **sequentially** — each scene waits for the previous one to fully complete (including polling) before starting. For a 60s video with 4 scenes, this means ~4x the generation time.

## Root Causes Identified

1. **Sequential scene generation** (`backgroundAdDirectorService.ts` line 385-461): A `for` loop with `await` processes scenes one-by-one
2. **2-second artificial delay** between scenes (line 460): `await new Promise(r => setTimeout(r, 2000))`
3. **5-second polling interval** (line 519): Could start faster and adapt
4. **Score + improve loop** (lines 292-338): Up to 2 improvement attempts per prompt, each requiring 2 edge function calls — can be made optional or parallelized better

## Solution — Parallel Scene Generation + Faster Polling

### 1. `src/lib/backgroundAdDirectorService.ts`

**Parallelize scene generation:**
- Replace the sequential `for` loop (lines 385-461) with `Promise.allSettled()` — submit all scenes simultaneously, then poll all in parallel
- Remove the 2-second inter-scene delay

**Adaptive polling interval:**
- Start polling at 3s, increase to 5s after 10 attempts (API is doing heavy work early, results come later)
- Poll all active scenes in a single loop instead of separate sequential polls

**Skip quality improvement when speed matters:**
- Make the score+improve phase run in parallel for all prompts (already partially parallel)
- Reduce `MAX_IMPROVE_ATTEMPTS` from 2 to 1

### 2. `src/components/social/VideoStudioContent.tsx`

- Reduce initial poll interval from 5000ms to 3000ms for single-clip generation

## Changes Summary

```text
Before (sequential):
  Scene 1: submit → poll (2-10min) → done
  Scene 2: submit → poll (2-10min) → done  
  Scene 3: submit → poll (2-10min) → done
  Total: 6-30 min

After (parallel):
  Scene 1: submit ─┐
  Scene 2: submit ─┤→ poll all → all done
  Scene 3: submit ─┘
  Total: 2-10 min (limited by slowest scene)
```

| File | Change |
|---|---|
| `backgroundAdDirectorService.ts` | Parallel scene submission + parallel polling, remove 2s delay, adaptive poll interval |
| `VideoStudioContent.tsx` | Reduce poll interval from 5s to 3s |

