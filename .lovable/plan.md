

# Fix Video Duration: One 15s Clip Per Scene

## Problem
Currently, the AI creates 4-8 short scenes (3s each) regardless of duration. The user wants:
- **15s** → 1 video clip of 15 seconds
- **30s** → 2 video clips of 15 seconds each
- **1min** → 4 video clips of 15 seconds each

## Root Cause
Two places control scene count and duration:
1. The AI system prompt tells it to create 4-14 scenes
2. The client divides total duration by scene count, producing short clips

## Changes

### 1. `supabase/functions/ad-director-ai/index.ts` — Update AI prompt (line ~357)

Change the PACING section in `ANALYZE_SCRIPT_PROMPT`:

**Before:**
```
Scene count: 30s ad = 6-8 scenes, 15s = 4-5, 60s = 10-14
No scene < 1.5s or > 6s
```

**After:**
```
Scene count: 15s ad = 1 scene, 30s = 2 scenes, 60s = 4 scenes
Each scene MUST be exactly 15 seconds. No exceptions.
```

Also update the segment timing rules to match (Hook: 15s, etc.)

### 2. `src/lib/backgroundAdDirectorService.ts` — Fix per-scene duration (lines 365-367)

Replace the dynamic calculation with a fixed 15s per clip:

```ts
const sceneDuration = 15; // Always generate 15-second clips
```

### 3. `src/lib/backgroundAdDirectorService.ts` — Pass scene count hint to AI

In the `analyze-script` call (~line 218-228), pass the expected scene count so the AI knows exactly how many scenes to create:

```ts
const sceneCount = userDuration <= 15 ? 1 : userDuration <= 30 ? 2 : 4;
```

Add `sceneCount` to the edge function body, and reference it in the user prompt sent to the AI.

### 4. `supabase/functions/ad-director-ai/index.ts` — Use `sceneCount` in the user prompt

In `handleAnalyzeScript`, read `body.sceneCount` and append to the user prompt:
```
Required scene count: ${sceneCount} scenes of 15 seconds each.
```

| File | Change |
|---|---|
| `supabase/functions/ad-director-ai/index.ts` | Update PACING rules in system prompt to enforce 15s clips |
| `src/lib/backgroundAdDirectorService.ts` | Set `sceneDuration = 15`, calculate and pass `sceneCount` to edge function |

