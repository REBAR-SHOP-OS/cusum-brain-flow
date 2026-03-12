
Goal: make Ad Director output a real ~30s ad (not a single 15s clip), include voiceover, and stop silent “slideshow-like” results.

What I found
1) Generation is active and polling is working (jobs do complete).
2) Export is the main bug: it always sets `finalVideoUrl` to the first completed clip, so you only get one short clip.
3) Per-scene generation is hardcoded to 15s (`duration: 15`) instead of using script segment timings (0:00–0:30 total).
4) Voiceover is not implemented in the Ad Director export path.
5) Subtitles/logo/end-card toggles are currently UI-only (not applied in final render).

Implementation plan
1) Fix scene duration at generation time (`AdDirectorContent.tsx`)
- Replace hardcoded 15s with segment-based duration per scene:
  - `sceneDuration = clamp(segment.endTime - segment.startTime, 2, 15)`
- Add motion-enforcing guidance (and negative prompt) so scenes are less likely to look like static push/zoom shots.
- Keep provider tracking per clip so polling/render paths remain deterministic.

2) Build real final assembly pipeline for export (new utility + `AdDirectorContent.tsx`)
- Add a client-side stitch utility to render clips sequentially into one continuous video timeline (scene order from storyboard).
- Trim each scene to its target duration before/while stitching so total lands near 30s.
- Apply optional overlays in this order:
  - subtitles (if enabled),
  - logo watermark (if enabled),
  - end card (if enabled).
- Set `finalVideoUrl` to the stitched output (single exported ad), not first clip.

3) Add voiceover generation + merge (Ad Director export path)
- During export:
  - If user uploaded an audio/voice file in assets, use it.
  - Else auto-generate narration text from script, then synthesize voiceover audio via existing TTS backend function.
- Merge stitched video + voiceover into final output.
- If voiceover step fails, continue with silent video but show clear warning toast.

4) Improve fallback transparency
- If any scene returns slideshow/image fallback, mark it clearly in UI and toast a warning (so user knows it is not true generated motion).
- Prevent “looks finished but not ad-ready” confusion by showing “Ad quality warnings” before export.

5) Update preview UX (`FinalPreview.tsx`)
- Show expected total runtime and actual stitched runtime once export completes.
- Add explicit “Final ad assembled” state so user knows preview is the stitched result, not a raw scene clip.

6) Live verification (end-to-end)
- Run a real flow on `/ad-director`:
  1. Analyze script
  2. Generate all scenes
  3. Export final ad
- Confirm:
  - runtime is ~30s (not 15s single clip),
  - audio track exists,
  - scene transitions occur (not one static/push shot),
  - overlays honor toggles,
  - export is playable/downloadable.

Technical notes
- Existing media helpers in the codebase already support watermarking and audio merge patterns; I will reuse those patterns for Ad Director consistency.
- Client-side assembly will output browser-recorded media format (typically WebM). If strict MP4 is mandatory, we’ll need backend transcoding as a follow-up step.
