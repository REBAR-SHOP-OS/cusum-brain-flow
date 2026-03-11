

## Multi-Scene Video Stitching + Video Library Storage

### Problem
When you request a 30s or 60s video, the API models only support short clips (Veo: max 8s, Sora: max 12s). The edge function silently snaps to the nearest valid duration, so you always get an 8s clip.

### Solution
Generate multiple short clips as "scenes" and concatenate them server-side into one final video. Also create a persistent video storage bucket so generated videos can be saved and reused.

### Architecture

```text
User requests 30s video
        │
        ▼
  Edge function calculates:
  30s ÷ 8s/clip = 4 clips needed
        │
        ▼
  Generate 4 clips in parallel
  (each with scene-specific prompt variation)
        │
        ▼
  Download all clips → concatenate via FFmpeg (Deno)
        │
        ▼
  Upload final video to "generated-videos" bucket
        │
        ▼
  Return public URL to client
```

### Changes

#### 1. Create storage bucket: `generated-videos`
- SQL migration to create the bucket with public access
- RLS policies: authenticated users can upload/read their own videos

#### 2. Update `supabase/functions/generate-video/index.ts`
- **Multi-scene logic**: When `duration > maxClipDuration`, split into multiple generation requests
- For each scene, vary the prompt slightly (e.g., "Scene 1 of 4: opening shot...", "Scene 2 of 4: mid-shot...")
- Generate clips in parallel, poll all jobs until complete
- **Concatenation**: Use FFmpeg WASM or simple binary concat for MP4 clips
- Upload final stitched video to `generated-videos` bucket
- Return the permanent storage URL
- New action: `"generate-multi"` for multi-scene requests; single clips still use `"generate"`

#### 3. Update `VideoGeneratorDialog.tsx`
- When duration > model's max clip length, use multi-scene flow
- Show per-scene progress (e.g., "Generating scene 2 of 4...")
- Add "Save to Library" button alongside "Use in Post"
- Add a "Video Library" tab/section showing previously saved videos from the bucket

#### 4. Create `src/components/social/VideoLibrary.tsx`
- Grid of saved videos from `generated-videos` bucket
- Each card: thumbnail preview, duration, date, delete button
- "Use in Post" action to pick a saved video
- Upload button to add external videos to the library

### Technical Details

**Scene prompt splitting**: The edge function will use the original prompt as a base and generate scene descriptions via a quick LLM call:
```
"Given this video concept: [user prompt], create 4 distinct continuous camera shots 
that together tell a cohesive visual story. Each shot should be 8 seconds of 
continuous action (no cuts, no editing effects)."
```

**Concatenation approach**: Since FFmpeg WASM is too heavy for edge functions (150MB limit), we'll use a simpler approach:
- Download each clip as raw bytes
- For MP4 files, use a lightweight TS-based MP4 muxer to concatenate
- Alternative: return all clip URLs to the client side, where we concatenate using MediaSource API or canvas-based stitching

**Storage structure**: `generated-videos/{user_id}/{uuid}.mp4`

### Files
1. **SQL migration** — Create `generated-videos` bucket + RLS policies
2. `supabase/functions/generate-video/index.ts` — Multi-scene generation + storage upload
3. `src/components/social/VideoGeneratorDialog.tsx` — Multi-scene progress UI + save to library
4. `src/components/social/VideoLibrary.tsx` — New component for browsing saved videos

