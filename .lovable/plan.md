

# Fix Video History: Show Previews + Convert All Persian to English

## Problem
1. Draft cards show a document icon placeholder instead of actual video thumbnails from clips
2. All Persian text in the Ad Director agent must be converted to English

## Changes

### 1. `src/components/ad-director/VideoHistory.tsx` — Fix thumbnails + English

| Line | Persian → English |
|---|---|
| 27 | `ویدئوهای قبلی شما` → `Your Previous Videos` |
| 93 | `پیش‌نویس` → `Draft` / `ویدیو در دسترس نیست` → `Video unavailable` |
| 118 | Badge `پیش‌نویس` → `Draft` |
| 136 | title `دانلود` → `Download` |
| 145 | title `حذف` → `Delete` |

**Thumbnail fix**: The draft cards currently extract `videoUrl` from clips, but if the clips array stores data differently (e.g. nested structure or different key), the URL resolves to `null` and falls back to the icon. Will update the extraction logic to also try `video_url`, `url`, or first available video source from the clips array. Additionally, change `preload="metadata"` to eagerly load a poster frame so thumbnails render.

### 2. `src/components/ad-director/AdDirectorContent.tsx` — English

| Line | Persian → English |
|---|---|
| 608 | Toast title/desc → `"Draft saved"` / `"Project will appear in your video history."` |
| 610 | Toast → `"Failed to save"` |
| 615 | Button label `ذخیره پیش‌نویس` → `Save Draft` |

### 3. `src/components/ad-director/ChatPromptBar.tsx` — English

| Line | Persian → English |
|---|---|
| 140 | Toast → `"Prompt ready"` / `"X scenes with voiceover generated. Review and edit."` |
| 144 | Toast → `"Prompt generation failed"` / `err.message or "Please try again"` |
| 545 | Tooltip → `"Auto-generate prompt"` / `"Select a style and product, or upload an image"` |

