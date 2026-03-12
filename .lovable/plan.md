
I checked the runtime evidence. The download click is firing, but it immediately shows an error toast (`دانلود فایل با خطا مواجه شد`). This matches the current code path in `SceneCard` → `downloadFile()`, where a plain `fetch(url)` is required before downloading. If the clip URL is from an external provider without browser CORS access, `fetch` fails and download always errors.

Plan to fix:

1) Make clip downloads resilient to CORS/provider URLs
- Update `src/lib/downloadUtils.ts` to support a fallback chain:
  - Try direct `fetch(url)` → blob download (current behavior).
  - If that fails, proxy the video through backend function `generate-video` with `action: "download"` and provider metadata, then download returned blob.
  - If proxy also fails, final fallback: open URL in a new tab so user can still save manually.
- Add explicit console diagnostics (status/source/fallback used) so logs are actionable next time.

2) Wire Ad Director scene button to use proxy fallback
- Update `src/components/ad-director/SceneCard.tsx` download handler to call the enhanced utility with video-proxy options.
- Keep image scenes (`data:image/...`) on direct local download path.
- Preserve correct filename extension (`.png` for data-image scenes, `.mp4` for video clips).

3) Optional hardening (same root cause)
- Apply the same proxy fallback where completed clips are auto-archived in `AdDirectorContent` (currently also uses raw `fetch(clip.videoUrl)` and can silently fail for the same reason).

Technical details:
- Root cause is not button wiring; it is URL accessibility policy mismatch.
- Playback can work while `fetch` fails (video tags can stream some remote sources that JS fetch cannot read).
- The current utility swallows specific error details, so adding structured logs is part of the fix.

Verification after implementation:
- Click scene “Download” on at least 3 clip types (fresh generated clip, archived clip URL, static-card image).
- Confirm file saves locally with correct extension and non-zero size.
- Confirm no error toast appears in normal flow.
- Confirm fallback path works when direct fetch is blocked.
