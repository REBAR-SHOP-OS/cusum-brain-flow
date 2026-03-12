

# AI Video Director — Render Pipeline Fix

## Core Constraint

Supabase Edge Functions (Deno runtime) **cannot run ffmpeg binaries**. They have no filesystem access, no binary execution, and a 60-second timeout. A true ffmpeg server pipeline requires a dedicated compute service (AWS Lambda with ffmpeg layer, a VPS, or a cloud video API like Shotstack/Creatomate).

## What's Actually Broken

The current `videoStitch.ts` uses `Canvas.captureStream()` + `MediaRecorder`:
- Outputs **WebM** (not MP4) — the `.mp4` download filename is a lie
- `requestAnimationFrame` timing is unreliable across browsers — causes blank/dropped frames
- Audio mixing via `AudioContext.createMediaElementSource` silently fails on CORS or autoplay restrictions
- No error recovery — a single clip load failure kills the entire export
- No validation — "Final ad assembled" is set optimistically before the blob is even playable

## Proposed Architecture (Two Options)

### Option A: External Render Service (Recommended for Production)
Use a cloud video assembly API (Shotstack, Creatomate, or similar) via an edge function proxy. This gives real ffmpeg, real MP4, real audio mixing. Requires an API key from the user.

### Option B: Improved Client-Side Pipeline (No External Dependency)
Fix the existing browser-based stitcher to be reliable, add proper state tracking and validation. No true MP4 (still WebM), but functional and honest about it.

**I recommend starting with Option B** (no new dependencies, fixes the actual bugs) and adding Option A later as a premium export path.

## Implementation Plan — Option B

### 1. Database: `render_jobs` table
Track render state server-side for auditability.

```sql
CREATE TABLE public.render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scenes_ready','voice_ready','assembly_in_progress','assembled','render_failed')),
  scene_count int DEFAULT 0,
  completed_scenes int DEFAULT 0,
  voice_url text,
  music_url text,
  final_video_url text,
  final_file_size bigint,
  error_message text,
  error_stage text,
  render_log jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own render jobs" ON public.render_jobs
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### 2. Fix `videoStitch.ts` — Reliability Overhaul
- **Pre-validate all clips**: Check each video loads and has valid dimensions before starting
- **Sequential clip rendering with retry**: If a clip fails to play, retry once, then skip with a black frame + error overlay
- **Accurate timing**: Use `video.ontimeupdate` with a safety `setTimeout` fallback instead of relying solely on `requestAnimationFrame` race conditions
- **Audio improvements**: Fetch voiceover as blob first, validate it's playable, then mix. If AudioContext fails, continue without audio rather than crashing
- **Output honesty**: Name download as `.webm` (what it actually is), or use `MediaRecorder` with `video/mp4` mime where supported (Safari)
- **Post-stitch validation**: After blob creation, create a test `<video>` element, verify it loads and has `duration > 0` before declaring success

### 3. Add `useRenderPipeline` hook
New hook that orchestrates the full render flow with explicit states:

```
draft → scenes_ready → voice_ready → assembly_in_progress → assembled | render_failed
```

Each transition logs to the `render_jobs` table. The hook exposes:
- `renderState` (current status)
- `renderError` (error message + failing stage)
- `renderLog` (array of timestamped log entries)
- `startRender()` / `retryRender()`

### 4. Voiceover Pipeline Fix
- Generate voiceover per-segment (not one giant blob) for better timing alignment
- Compare voice duration vs scene duration — warn if mismatch > 1s
- If total voice exceeds total video, show validation error before assembly
- Store voice blob URLs in render job state

### 5. Frontend: FinalPreview Overhaul
- **Only show video player when `renderState === 'assembled'` AND `finalVideoUrl` is validated**
- **Show `render_failed` state clearly** with error stage badge, message, and retry button
- **Add "Download Render Log" button** that exports the `renderLog` array as JSON
- **Progress bar during assembly** showing which stage is active (voice → stitch → validate)
- **Remove optimistic "Final ad assembled" badge** — only show after validation passes

### 6. Export Validation Layer
Before setting `assembled`:
1. Create test `<video>` from blob URL
2. Verify `loadedmetadata` fires
3. Verify `duration > 0`
4. Verify blob `size > 0`
5. If any check fails → `render_failed` with specific error

## Files Modified

1. **New migration** — `render_jobs` table + RLS
2. **`src/lib/videoStitch.ts`** — Reliability fixes: pre-validation, retry, timing, audio fallback, post-validation
3. **`src/hooks/useRenderPipeline.ts`** (new) — State machine orchestrating voice → stitch → validate flow
4. **`src/components/ad-director/FinalPreview.tsx`** — Render state UI, error display, retry button, log download
5. **`src/components/ad-director/AdDirectorContent.tsx`** — Wire useRenderPipeline, remove optimistic export logic

## What This Does NOT Solve (Requires External Service)
- True MP4 output (browser MediaRecorder doesn't support h264 in most browsers)
- ffprobe validation
- Server-side ffmpeg normalization (1920x1080, 30fps, yuv420p)
- Music ducking under voice
- Subtitle burn-in via ffmpeg (current canvas overlay approach works but isn't "burned in")
- Image-to-video conversion with motion (Ken Burns) via ffmpeg

These require a compute service with ffmpeg access. If you want to pursue that, I'd recommend Shotstack API ($49/mo) or a dedicated render microservice.

