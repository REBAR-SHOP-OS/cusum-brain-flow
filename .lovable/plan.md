## Why the card failed

The failed post in your screenshot is a video whose source file is a browser-recorded **WebM (VP9 + Opus)** produced by `MediaRecorder` in `src/lib/slideshowToVideo.ts` and `src/lib/videoAudioMerge.ts`. Instagram's Graph API only accepts **MP4 with H.264 video + AAC audio**, so the codec probe in `supabase/functions/_shared/instagramPublish.ts` correctly rejects it with `INSTAGRAM_VIDEO_SPEC_ERROR` — that's exactly the red message in the right panel (`Page "Ontario Steel Detailing": Instagram Reels require a real MP4 video encoded as H.264 with AAC audio…`).

Today the system only **blocks** the bad video — it never converts it. So every time Vizzy / AI Video Director outputs a WebM (no Wan/Veo MP4 source, just the canvas slideshow path), Instagram publishing fails at the scheduled slot and the card lands in `failed`. Facebook/LinkedIn cards on the same post succeed because they accept WebM.

## Fix (surgical, additive only)

Add an automatic WebM→MP4 transcode step that runs **before** Instagram publish, and a one-time retry for the already-failed card.

### 1. New edge function: `transcode-to-mp4`
A trimmed copy of the existing `supabase/functions/gce-video-assembly/index.ts` pipeline (same GCE + ffmpeg pattern, already proven in this codebase). Input: a single source URL. Output: an MP4 (H.264 + AAC, `yuv420p`, `+faststart`) uploaded to the same `social-media` bucket, and the public URL returned.

```text
ffmpeg -y -i input -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart output.mp4
```

### 2. Hook it into the publish path
In `supabase/functions/_shared/instagramPublish.ts`, right after `probeVideoForInstagram(...)` decides `isInstagramReady === false` AND the URL/content-type indicates WebM:

- Call `transcode-to-mp4` with `imageUrl`.
- Re-probe the MP4 result.
- If probe passes, swap `imageUrl` for the MP4 URL and continue the IG container POST.
- Persist the MP4 URL back to `social_posts.image_url` so future retries skip transcoding.
- If transcode itself fails, fall through to the existing `INSTAGRAM_VIDEO_SPEC_ERROR` path (no behavior regression).

This single hook covers both manual "Publish Now" (`social-publish`) and the cron path (`social-cron-publish`) because both route IG through `publishInstagramMedia`.

### 3. Heal the failed card
After deploying, manually retry the failed post (the "Retry Publishing" button already shown in your screenshot) — the new transcode path will now succeed instead of bouncing on codec.

### 4. Regression test
Add `tests/regression/social/instagram-auto-transcode-webm.test.ts` verifying that `instagramPublish.ts` invokes the transcoder when the probe rejects with a WebM-style reason, and that the IG container POST receives the MP4 URL, not the WebM URL.

## Out of scope (intentionally)

- Not changing `slideshowToVideo.ts` / `videoAudioMerge.ts` to record MP4 directly. Browser `MediaRecorder` MP4 support is inconsistent (Chrome only, recent versions), so the safer fix is a server-side normalizer.
- Not removing the existing IG WebM block — it stays as a safety net for cases where transcoding fails or the source is some other unsupported codec.
- Not touching Facebook/LinkedIn publish paths — they're already working.

## Files

**New**
- `supabase/functions/transcode-to-mp4/index.ts`
- `tests/regression/social/instagram-auto-transcode-webm.test.ts`

**Edited**
- `supabase/functions/_shared/instagramPublish.ts` — add transcode-then-retry step before the spec-error return.
- `supabase/config.toml` — register the new function (if not auto-registered).
