## Completed: Upgrade Wan 2.1 → Wan 2.6

### Changes
- **Edge function**: Updated `generate-video` to use `wan2.6-t2v` model with 1080P resolution, 2-15s per clip, prompt extension, and auto-generated audio
- **UI**: Updated model label from "Alibaba Wan 2.1" to "Alibaba Wan 2.6", Balanced mode now uses Wan 2.6 as default provider
- **Duration**: Balanced mode options updated to 5s, 10s, 15s, 30s, 60s (matching Wan 2.6 capabilities)
- **Multi-scene**: Wan max clip duration increased from 8s to 15s, reducing scene count for long videos (30s = 2 clips, 60s = 4 clips)

## Completed: Add All Wan 2.6 Capabilities

### Changes
1. **Image-to-Video (I2V)**
   - Added `wan2.6-i2v` and `wan2.6-i2v-flash` models as new video options
   - New `wanI2vGenerate()` edge function helper — sends `img_url` in input payload
   - Reference image is uploaded to `social-media-assets` storage, public URL passed to DashScope
   - UI enforces ref image upload when I2V model is selected

2. **Custom Audio Sync**
   - Audio file upload button (MP3/WAV) appears when Wan T2V model is selected
   - Audio uploaded to `social-media-assets` storage, URL passed as `audio_url` parameter
   - Only available for T2V (not I2V, which doesn't support audio_url)

3. **Negative Prompts**
   - Toggle "Negative" pill in prompt bar for Wan models
   - Expandable text input for negative prompt (e.g., "blur, text, watermark")
   - Passed as `negative_prompt` to DashScope API for both T2V and I2V

4. **Multi-Scene Fix**
   - Wan max clip duration corrected to 15s (was incorrectly set to 8s)
   - Negative prompt and audio sync passed through to multi-scene generation

## Completed: Fix Broken Logo + Mandatory Watermark + GCE Architecture

### Changes
1. **Brand-assets storage bucket** — Created `brand-assets` bucket with RLS for persistent logo uploads
2. **Logo upload fix** — `ScriptInput.tsx` now uploads logos to Supabase storage instead of using temporary blob URLs
3. **Mandatory watermark** — Removed `logoEnabled` toggle; logo watermark is always active when a logo URL exists
4. **GCE video assembly** — New `gce-video-assembly` edge function orchestrates server-side FFmpeg assembly via preemptible GCE VMs (falls back to browser stitching when GCE credentials are not configured)
5. **FinalPreview.tsx** — Logo toggle replaced with static badge showing watermark status
6. **Export flow** — Tries server-side GCE assembly first, then falls back to browser-side stitching

### GCE Setup Required
To enable server-side video assembly:
- Add `GOOGLE_CLOUD_PROJECT_ID` secret
- Add `GOOGLE_CLOUD_SERVICE_KEY` secret (service account JSON with Compute Engine + Cloud Storage permissions)
- Without these, browser-side assembly is used automatically
