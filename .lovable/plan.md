

## Plan: Add Free Video Fallback via AI Image Slideshow

### Problem
Both Veo (Google) and Sora (OpenAI) hit billing limits, leaving video generation completely broken with no alternative.

### Solution
Add a third-tier fallback that uses **Lovable AI's image generation models** (already included, no extra API keys or costs) to generate a sequence of scene images, then compile them into a smooth slideshow video on the client using canvas + MediaRecorder. This produces a polished motion slideshow with Ken Burns-style zoom/pan effects rather than AI-generated video, but it's free and always available.

**Flow**: Veo → Sora → Image Slideshow (free fallback)

### How it works

1. When both Veo and Sora fail with capacity errors, the edge function switches to "slideshow" mode
2. Uses Lovable AI gateway (`google/gemini-3.1-flash-image-preview`) to generate one image per scene — this is free via the already-configured `LOVABLE_API_KEY`
3. Returns the image URLs to the client with `mode: "slideshow"`
4. Client-side utility compiles images into a video using canvas with smooth Ken Burns transitions (zoom, pan, crossfade) via `MediaRecorder`

### File Changes

| File | Change |
|------|--------|
| `supabase/functions/generate-video/index.ts` | Add slideshow fallback in `generate` and `generate-multi` actions — when both providers fail with capacity errors, generate images via Lovable AI gateway instead; return `mode: "slideshow"` with image URLs |
| `src/lib/slideshowToVideo.ts` | **New** — Takes an array of image URLs + duration per image, renders them on canvas with Ken Burns effects, exports as MP4 blob via MediaRecorder |
| `src/components/social/VideoGeneratorDialog.tsx` | Detect `mode: "slideshow"` response, call `slideshowToVideo()` to compile, show result with a note that it's a slideshow fallback |

### Edge function slideshow logic (pseudocode)

```text
generate-multi:
  try Veo → catch capacity → try Sora → catch capacity →
    // Both exhausted: slideshow fallback
    for each scene prompt:
      call Lovable AI gateway with gemini-3.1-flash-image-preview
      get image data
      upload to storage
    return { mode: "slideshow", imageUrls: [...], clipDuration }
```

### No database changes needed

