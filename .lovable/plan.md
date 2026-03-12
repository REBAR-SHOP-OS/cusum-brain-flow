

# Plan: Add All Wan 2.6 Capabilities to Video Studio

## Current State
- **Text-to-Video (T2V)**: Already implemented via `wan2.6-t2v`
- **Image-to-Video (I2V)**: Not implemented — reference image upload exists in UI but is unused for Wan
- **Multi-shot narrative**: Not enabled (Wan 2.6 supports `shot_type: "multi"`)
- **Custom audio sync**: Not implemented (Wan 2.6 supports `audio_url` parameter)
- **Negative prompts**: Not implemented

## What to Add

### 1. Image-to-Video (Wan 2.6 I2V)
- Add `wan2.6-i2v` and `wan2.6-i2v-flash` as new video model options
- New `wanI2vGenerate()` helper in edge function — same endpoint but with `img_url` in input
- When user uploads a reference image, upload it to storage, get public URL, pass as `img_url`
- Same polling/download flow as T2V

### 2. Multi-Shot Narrative
- When duration > single clip, pass `shot_type: "multi"` + `prompt_extend: true` to let Wan handle multi-shot internally (up to 15s) instead of splitting into separate API calls
- This produces better narrative coherence than our manual scene-splitting

### 3. Custom Audio Sync
- Allow users to upload an audio file (MP3/WAV, up to 15MB) alongside the prompt
- Upload to storage, pass the public URL as `audio_url` parameter to Wan
- Add audio upload button to the prompt bar when Wan provider is selected

### 4. Negative Prompts
- Add optional "Negative prompt" input field
- Pass `negative_prompt` parameter to Wan API

## Technical Changes

### Edge Function (`supabase/functions/generate-video/index.ts`)
- Add `wanI2vGenerate()` helper using same endpoint with `img_url` input field
- Add `imageUrl`, `audioUrl`, `negativePrompt`, `shotType` to the Zod schema
- Pass `negative_prompt`, `audio_url`, `shot_type` params to `wanGenerate()`
- For I2V: model changes to `wan2.6-i2v` or `wan2.6-i2v-flash`

### UI — Prompt Bar (`src/components/social/VideoStudioPromptBar.tsx`)
- Add `wan2.6-i2v` and `wan2.6-i2v-flash` to `VIDEO_MODELS`
- Add audio file upload button (visible when Wan model selected)
- Add negative prompt collapsible input
- Pass new props up

### UI — Content (`src/components/social/VideoStudioContent.tsx`)
- Wire reference image upload to storage + pass URL to edge function
- Wire audio file upload + pass URL
- Wire negative prompt state
- When Wan I2V model selected, require a reference image

### Storage
- Reuse existing `social-media-assets` or `generated-videos` bucket for reference image and audio uploads

## File Changes Summary
1. `supabase/functions/generate-video/index.ts` — Add I2V helper, extend schema, add audio/negative/shot params
2. `src/components/social/VideoStudioPromptBar.tsx` — Add I2V models, audio upload, negative prompt field
3. `src/components/social/VideoStudioContent.tsx` — Wire new capabilities, upload reference assets
4. `src/hooks/usePromptTransformer.ts` — No changes needed
5. `.lovable/plan.md` — Update memory

