

# رفع zoom/crop در خروجی Auto-Edit

## ریشه مشکل

در `src/lib/videoStitch.ts`، تابع `stitchClips` همیشه از منطق **`fitCover`** استفاده می‌کند (خط ۶۶۷–۶۷۰):

```ts
const drawFit = (v) => {
  const f = fitCover(v.videoWidth, v.videoHeight, W, H);
  ctx.drawImage(v, f.sx, f.sy, f.sw, f.sh, 0, 0, W, H);
};
```

`fitCover` معادل CSS `object-fit: cover` است — یعنی منبع را آنقدر بزرگ می‌کند که کل canvas را **بپوشاند** و سپس **center-crop** می‌کند. این برای Ad Director (که aspect ratio هدف از پیش انتخاب شده) درست است، اما برای Auto-Edit مشکل‌ساز است:

- Auto-Edit در `AutoEditDialog.tsx` (خط ۱۸۶–۱۹۰) `stitchClips` را با `overlays = {}` صدا می‌زند → هیچ `aspectRatio` نداده.
- در این حالت `stitchClips` ابعاد canvas را از **`validatedClips[0].video.videoWidth/Height`** می‌گیرد (خط ۳۹۵–۳۹۸).
- اما segmentهای WebM که توسط `cutVideoIntoSegments` (MediaRecorder + canvas.captureStream) ساخته می‌شوند، در هنگام decode می‌توانند ابعاد گزارش‌شده‌ی متفاوتی داشته باشند (به‌خصوص ویدیوهای عمودی موبایل که codec گاهی به دیمنشن "نرمال" decode می‌کند).
- وقتی aspect ratio segment با aspect canvas جزئی فرق دارد، `fitCover` بخشی را crop می‌کند → نتیجه‌ای که کاربر می‌بیند: zoom-in و قطع لبه‌ها.

## رفع

### A) تابع `fitContain` اضافه کن به `videoStitch.ts`
معادل `object-fit: contain` — منبع کامل نمایش داده می‌شود، اگر aspect نخواند letterbox سیاه/پر اطراف می‌گذارد:

```ts
export function fitContain(srcW, srcH, dstW, dstH) {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  let dw, dh;
  if (srcRatio > dstRatio) { dw = dstW; dh = dstW / srcRatio; }
  else { dh = dstH; dw = dstH * srcRatio; }
  return { dx: (dstW - dw) / 2, dy: (dstH - dh) / 2, dw, dh };
}
```

### B) اضافه کردن گزینه‌ی `fitMode` به `StitchOverlayOptions`
- مقادیر: `"cover"` (default برای backward compatibility) یا `"contain"`.
- در `drawFit` هر دو حالت پشتیبانی شود:
  ```ts
  if (fitMode === "contain") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const f = fitContain(v.videoWidth, v.videoHeight, W, H);
    ctx.drawImage(v, 0, 0, v.videoWidth, v.videoHeight, f.dx, f.dy, f.dw, f.dh);
  } else { /* current fitCover path */ }
  ```
- این تغییر در `drawFit` هر دو scope (عادی و در transition) اعمال شود.

### C) برای Auto-Edit: حفظ ابعاد دقیق منبع، بدون crop
در `AutoEditDialog.tsx` (خط ۱۸۶):
- پاس دادن `aspectRatio` نه — اما گزینه‌ی **`fitMode: "contain"`** + ست کردن دستی **`canvasWidth/canvasHeight`** برابر اصلی منبع.
- اضافه کردن دو فیلد جدید به `StitchOverlayOptions`: `canvasWidth?: number` و `canvasHeight?: number` که اگر داده شد، canvas دقیقاً همان ابعاد را می‌گیرد (به‌جای logic فعلی).
- در `AutoEditDialog`: قبل از `stitchClips`، یک `<video>` موقت روی فایل اول بساز، صبر کن تا metadata بیاید، و `videoWidth/Height` آن را به عنوان canvas dims بفرست. به این ترتیب خروجی نهایی **دقیقاً** ابعاد ویدیوی منبع را دارد و هیچ crop/letterbox رخ نمی‌دهد.

### D) Backward compatibility
- پیش‌فرض `fitMode = "cover"` → Ad Director (که aspect ratio هدف انتخاب می‌کند) دست‌نخورده می‌ماند.
- فقط Auto-Edit از `contain` + dims native استفاده می‌کند.

## محدوده تغییر

تغییر می‌کند:
- `src/lib/videoStitch.ts`:
  - افزودن `fitContain`
  - افزودن `fitMode`, `canvasWidth`, `canvasHeight` به `StitchOverlayOptions`
  - استفاده از این مقادیر در logic ابعاد canvas (خطوط ۳۹۳–۴۰۱)
  - استفاده از `fitMode` در هر دو محل `drawFit` (داخل drawFrame و در شاخه‌های transition)
- `src/components/ad-director/AutoEditDialog.tsx`:
  - استخراج `videoWidth/Height` فایل اول قبل از stitch
  - پاس دادن `{ fitMode: "contain", canvasWidth, canvasHeight }` به `stitchClips`

تغییر **نمی‌کند:**
- منطق Ad Director (Chat/Pro Editor) و رفتار `fitCover` پیش‌فرض
- منطق `cutVideoIntoSegments` یا extractKeyframes
- silent-video-only policy
- edge function `auto-video-editor`
- بقیه pipeline یا RLS

## مراحل اجرا

1. اضافه کردن `fitContain` و سه فیلد جدید به `StitchOverlayOptions` در `videoStitch.ts`
2. آپدیت منطق ابعاد canvas: اگر `canvasWidth/Height` پاس شد همان را استفاده کن
3. آپدیت `drawFit` (هر دو محل) برای پشتیبانی از `fitMode`
4. در `AutoEditDialog`: استخراج dims منبع از اولین فایل و پاس دادن مقادیر جدید
5. تست end-to-end با یک ویدیوی عمودی موبایل و یک ویدیوی landscape

## اعتبارسنجی

- ✅ ویدیوی نهایی Auto-Edit دقیقاً همان framing منبع را نشان می‌دهد (بدون zoom/crop)
- ✅ ابعاد خروجی برابر ابعاد ویدیوی منبع است (مثلاً منبع 1080×1920 → خروجی 1080×1920)
- ✅ Ad Director (Chat & Pro Editor) رفتار قبلی را حفظ می‌کند (fitCover با aspectRatio)
- ✅ silent-video-only policy رعایت می‌شود
- ✅ multi-clip Auto-Edit همچنان کار می‌کند (canvas dims از اولین کلیپ)

