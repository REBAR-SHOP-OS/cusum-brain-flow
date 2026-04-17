

## درخواست کاربر
هر ویدئوی source در preview و export باید بر اساس output type انتخاب‌شده resize شود (نه crop ساده، نه letterbox مشکی):
- **1:1** برای Instagram Posts → 1080×1080
- **9:16** برای Instagram Reels → 1080×1920
- **16:9** برای YouTube/Landscape → 1920×1080

سوژه باید centered بماند، بخش‌های مهم cut نشود، و کیفیت خروجی high باشد.

## یافته‌ی فنی
1. **Preview** (`ProVideoEditor.tsx` خط 2108): `object-contain` → letterbox سیاه دور ویدئو. کاربر این را نمی‌خواهد.
2. **Export** (`videoStitch.ts` خط 349-354): `W = video.videoWidth`, `H = video.videoHeight` — **به‌کلی aspect ratio انتخابی کاربر را نادیده می‌گیرد**. خروجی همیشه ابعاد source را دارد، نه target.
3. هیچ پارامتر `aspectRatio` به `stitchClips` پاس داده نمی‌شود.
4. `drawImage(video, 0, 0, W, H)` در حال حاضر stretch می‌کند — اگر W/H اضافه کنیم بدون smart-fit، تصویر تحریف می‌شود.

## برنامه (Surgical, Additive)

### ۱. ابزار smart-fit (cover with center)
در `videoStitch.ts` یک helper اضافه کنیم که **"cover" geometry** محاسبه کند — مثل CSS `object-fit: cover`:
- ویدئوی source را scale کند تا تمام canvas هدف را پر کند
- center-crop کند روی محور long-axis (مثل کار Instagram)
- تضمین کند سوژه (که معمولاً وسط فریم است) cut نشود

```ts
function fitCover(srcW: number, srcH: number, dstW: number, dstH: number) {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  let sx = 0, sy = 0, sw = srcW, sh = srcH;
  if (srcRatio > dstRatio) {
    // source wider → crop sides
    sw = srcH * dstRatio;
    sx = (srcW - sw) / 2;
  } else {
    // source taller → crop top/bottom
    sh = srcW / dstRatio;
    sy = (srcH - sh) / 2;
  }
  return { sx, sy, sw, sh };
}
```

### ۲. پاس دادن `aspectRatio` به stitch pipeline
- `StitchOverlayOptions` interface → افزودن `aspectRatio?: "16:9" | "9:16" | "1:1"`
- `RATIO_DIMS` map داخل `videoStitch.ts` → `[W, H]` صحیح برای هر نسبت (1920×1080, 1080×1920, 1080×1080)
- `stitchClips` پارامتر را بخواند و `canvas.width = targetW`, `canvas.height = targetH` ست کند
- در `AdDirectorContent.tsx` و `backgroundAdDirectorService.ts` و `useRenderPipeline.ts`، `aspectRatio` فعلی state را پاس دهیم

### ۳. اعمال smart-fit در drawImage
هر `ctx.drawImage(video, 0, 0, W, H)` (خطوط 623, 628, 633) → 
```ts
const { sx, sy, sw, sh } = fitCover(video.videoWidth, video.videoHeight, W, H);
ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
```
نتیجه: ویدئوی 16:9 درون frame 9:16 → vertically scaled to fill, sides cropped (center-preserving). ویدئوی 16:9 درون 1:1 → horizontally cropped از وسط.

### ۴. کیفیت بالای rendering
قبل از drawImage، روی ctx این تنظیمات اعمال شود:
```ts
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
```
این باعث می‌شود scaling در canvas از bilinear high-quality استفاده کند (نه nearest-neighbor).

### ۵. Preview UI: تغییر `object-contain` → `object-cover`
در `ProVideoEditor.tsx` خط 2108 و 2086 و 2092:
- `object-contain` → `object-cover` (ویدئو کل frame را پر می‌کند، crop از وسط، بدون نوار سیاه)
- این **دقیقاً** بازنمایی export نهایی خواهد بود (WYSIWYG)
- canvas های static-card همان `object-contain` بمانند (چون از قبل با ابعاد دقیق RATIO_DIMS رندر شده‌اند و نباید crop شوند)
- یا تنها `<video>` به cover سوییچ شود؛ canvas دست‌نخورده

### ۶. Bitrate و کیفیت encoder
بررسی کنیم encoder در `videoStitch.ts` (احتمالاً MediaRecorder) bitrate مناسب برای 1080p دارد. اگر default پایین است → افزایش به ~5-8 Mbps برای 1080p تا کیفیت high تضمین شود.

### ۷. آپشن کاربری (اختیاری ولی توصیه‌شده)
کنار picker aspect ratio، یک toggle کوچک:
- **Smart Fit (Cover)** ← default — پر کردن frame با center-crop
- **Fit (Letterbox)** — رفتار قدیمی با نوار سیاه
این flexibility می‌دهد بدون شکستن کیس‌های خاص.

## فایل‌های تغییرکننده
- `src/lib/videoStitch.ts` — helper `fitCover`, `RATIO_DIMS`, پارامتر `aspectRatio`, اعمال در drawImage، high-quality smoothing
- `src/components/ad-director/ProVideoEditor.tsx` — `object-contain` → `object-cover` روی video element
- `src/components/ad-director/AdDirectorContent.tsx` — پاس `aspectRatio` به `stitchClips`
- `src/lib/backgroundAdDirectorService.ts` — همان (پاس aspectRatio)
- `src/hooks/useRenderPipeline.ts` — پذیرش/پاس aspectRatio

## آنچه دست‌نخورده می‌ماند
- منطق timeline, overlays drag/resize (درصدی نسبت به container)
- voiceover, music, subtitles, transitions
- DB / RLS / edge functions
- منطق تولید scene (Wan 2.6 خودش با size صحیح generate می‌کند — این لایه فقط برای resize نهایی است وقتی source ≠ target)

## نتیجه
1. ✅ انتخاب 9:16 → ویدئو full-frame عمودی، center-cropped، بدون نوار سیاه
2. ✅ انتخاب 1:1 → ویدئو مربعی، center-cropped از وسط
3. ✅ انتخاب 16:9 → رفتار طبیعی (source معمولاً 16:9)
4. ✅ Export نهایی دقیقاً ابعاد social standard دارد (1080×1920, 1080×1080, 1920×1080)
5. ✅ کیفیت high (smoothing high + bitrate مناسب)
6. ✅ Preview = WYSIWYG export
7. ✅ زبان UI: انگلیسی

