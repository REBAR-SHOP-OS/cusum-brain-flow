

## Two Changes: Dynamic Brand Kit Logo in Videos + Video Library Preview

### 1. Use Brand Kit Logo in Video Generation (instead of hardcoded description)

Currently line 330 in `VideoGeneratorDialog.tsx` hardcodes a logo description:
```
"...a subtle gold circular coin logo watermark with a blue geometric 'G' symbol..."
```

**Change**: Import `useBrandKit` hook, fetch the logo URL, and include it in the prompt dynamically. If the brand kit has a `logo_url`, reference it in the prompt as the company's actual logo. This way if the logo changes in the brand kit, videos automatically use the updated branding.

- Import `useBrandKit` in `VideoGeneratorDialog.tsx`
- Build the branded prompt using `brandKit.logo_url` description and `brandKit.business_name`
- Same approach for `ImageGeneratorDialog.tsx` (line 92) to keep consistency

### 2. Add Video Preview/View in Video Library

Currently the library only shows thumbnails with hover-play and small "Use" / "Delete" buttons. No way to properly watch a video.

**Change**: Add a view/play dialog to `VideoLibrary.tsx`:
- Add a `Play` button overlay on each video card
- Clicking opens a dialog with a full `<video>` player (with controls)
- Include video date and a "Use in Post" button inside the dialog
- Add `Download` button in the preview dialog

### Files to modify
| File | Change |
|------|--------|
| `VideoGeneratorDialog.tsx` | Import `useBrandKit`, build branded prompt from brand kit data |
| `ImageGeneratorDialog.tsx` | Same — use brand kit logo dynamically |
| `VideoLibrary.tsx` | Add preview dialog with full video player, play button overlay |

