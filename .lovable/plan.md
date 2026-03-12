

# Fix Broken Logo + Mandatory Watermark + Google Cloud Compute Architecture

## Issues Found

1. **Broken logo image**: Logo is stored as `URL.createObjectURL(file)` — a temporary blob URL that dies on page reload. It needs to be uploaded to persistent storage.

2. **Logo watermark not mandatory**: Currently a toggle (`logoEnabled`). User wants it always on every generated clip, not just at export time.

3. **Google Cloud Compute Engine**: User wants a proper architecture using GCE for heavy video processing (assembly, watermarking, format conversion) instead of browser-side canvas stitching.

## Plan

### 1. Fix Logo Upload — Persist to Storage

**Migration**: Create a `brand-assets` storage bucket for logo files.

**`ScriptInput.tsx`**: When user picks a logo file, upload it to `brand-assets/{userId}/logo-{uuid}.png` via Supabase storage, then set `brand.logoUrl` to the permanent public URL instead of a blob URL.

### 2. Mandatory Logo Watermark

**`AdDirectorContent.tsx`**:
- Remove the `logoEnabled` state — logo is always enabled when a logo URL exists
- In `stitchClips` call, always pass `logo.enabled: !!brand.logoUrl` (no toggle)
- Apply logo watermark to **each individual scene clip** after generation completes (in `pollGeneration` success handler), using `applyLogoWatermark()` from `videoWatermark.ts`

**`FinalPreview.tsx`**:
- Remove the Logo toggle switch from the export options — it's always on
- Show a "Logo Watermark: Active" badge instead

### 3. Google Cloud Compute Engine Architecture

Create a new edge function `gce-video-assembly` that acts as an orchestrator for Google Cloud Compute Engine. The architecture:

```text
┌──────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Ad Director │────▶│  Edge Function   │────▶│  GCE VM (on-demand) │
│  (Browser)   │     │  gce-video-assem │     │  FFmpeg pipeline    │
│              │◀────│  bly             │◀────│  - concat clips     │
│              │     │  (orchestrator)  │     │  - burn watermark   │
│              │     │                  │     │  - encode H.264/MP4 │
│              │     │                  │     │  - upload to GCS    │
└──────────────┘     └──────────────────┘     └─────────────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │  Cloud Storage   │
                     │  (permanent URL) │
                     └──────────────────┘
```

**Edge function `gce-video-assembly/index.ts`**:
- Accepts: array of clip URLs, logo URL, brand info, subtitle segments
- Calls GCE API to spin up a preemptible VM with FFmpeg Docker container
- VM downloads clips, concatenates with FFmpeg, burns logo watermark, encodes to H.264 MP4
- Uploads result to Cloud Storage, returns permanent URL
- Falls back to browser-side stitching if GCE is unavailable

**However**, GCE requires a service account key and project setup. For now, I'll implement:
- The edge function as an **assembly orchestrator** that uses FFmpeg via a lightweight approach
- A `GOOGLE_CLOUD_PROJECT_ID` and `GOOGLE_CLOUD_SERVICE_KEY` secret requirement
- The architecture is ready but falls back to browser stitching until GCE credentials are configured

**`AdDirectorContent.tsx`**: Update export flow to try server-side assembly first, fall back to browser stitching.

## Files Modified

1. **New migration** — `brand-assets` storage bucket
2. **`src/components/ad-director/ScriptInput.tsx`** — Upload logo to storage, get permanent URL
3. **`src/components/ad-director/AdDirectorContent.tsx`** — Remove logo toggle, apply watermark per-clip after generation, try server-side export first
4. **`src/components/ad-director/FinalPreview.tsx`** — Remove logo toggle, show mandatory badge
5. **`supabase/functions/gce-video-assembly/index.ts`** (new) — GCE orchestrator edge function for server-side FFmpeg assembly
6. **`src/lib/videoStitch.ts`** — No changes (kept as browser fallback)

