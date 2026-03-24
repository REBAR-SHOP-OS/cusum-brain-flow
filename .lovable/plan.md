

## Cover Image on Instagram Reels — Why It Doesn't Show During Playback

### Root Cause: Instagram API Limitation (Not a Code Bug)

Your code is **correct** — it sends `cover_url` to the Instagram Graph API. But Instagram's `cover_url` parameter only sets the **static thumbnail** (the image shown in the grid/feed before someone taps to play). It does **NOT** overlay the cover onto the video during playback. This is an Instagram API limitation.

```text
What cover_url does:          What you want:
┌─────────────┐              ┌─────────────┐
│  Grid View  │              │  Playback   │
│  ┌───────┐  │              │  ┌───────┐  │
│  │ COVER │  │              │  │ VIDEO  │  │
│  │ IMAGE │  │  ← thumbnail │  │ + COVER│  │ ← burned in
│  │  ▶️   │  │    only       │  │OVERLAY │  │
│  └───────┘  │              │  └───────┘  │
└─────────────┘              └─────────────┘
```

### Solution: Burn Cover Into Video Before Upload

To get the cover image visible **during playback**, we need to composite it into the video file using server-side FFmpeg processing before uploading to Instagram.

#### New Edge Function: `video-add-cover`
Creates a new video file with the cover image burned in as an overlay (first 3-5 seconds with fade-out, or full duration as watermark).

**Process**:
1. Download original video + cover image
2. Use FFmpeg (via `ffmpeg-wasm` or a cloud service) to overlay the cover onto the video
3. Upload the composited video back to storage
4. Update `image_url` (the video URL) with the composited version before publishing

#### Challenge: FFmpeg in Edge Functions
Deno edge functions have a **50MB memory limit** and no native FFmpeg. Options:

| Approach | Feasibility |
|---|---|
| FFmpeg WASM in edge function | Risky — memory/timeout limits for large videos |
| External API (e.g., Creatomate, Shotstack) | Reliable but needs API key + cost |
| Client-side FFmpeg.wasm | Works but slow on mobile, blocks UI |
| Accept Instagram limitation | Zero effort — cover shows as thumbnail only |

### Recommendation

This is a significant engineering effort for a platform-specific limitation. Two practical options:

**Option A (Quick)**: Accept that Instagram uses `cover_url` as thumbnail only. The cover already shows in the grid — users see it before tapping play.

**Option B (Full fix)**: Integrate a video processing API (like Creatomate or Shotstack) to composite the cover image onto the video before upload. This would be a new edge function + API key setup.

Which approach would you prefer?

