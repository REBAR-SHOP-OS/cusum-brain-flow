

# رفع خطای "Clip 2 failed to load after retry"

## ریشه مشکل

در `src/lib/rawVideoUtils.ts → cutVideoIntoSegments`، هر سگمنت توسط `MediaRecorder` از `canvas.captureStream(30)` ضبط می‌شود. خروجی WebM این روش معمولاً **هدر Duration معتبر ندارد** (`duration = Infinity`) و گاهی Cue هم ندارد.

وقتی `videoStitch.ts → preloadAndValidate` (خط ۳۲۰–۳۵۲) یک `<video>` تازه می‌سازد و `src = blobUrl` می‌دهد، روی برخی بلاب‌ها (مخصوصاً وقتی چند کلیپ پشت هم پردازش می‌شود و حافظه مصرفی بالاست) `onerror` فایر می‌شود قبل از `onloadedmetadata` — مخصوصاً برای کلیپ دوم به بعد. retry هم چون از همان blob URL استفاده می‌کند، باز شکست می‌خورد.

نشانه‌ی دقیق در اسکرین‌شات: **"Clip 2 failed to load after retry: Clip 2 failed to load"** — یعنی هر دو attempt همزمان روی همان blob URL شکست خورده‌اند.

دلایل تکمیلی شکست:
- `crossOrigin` در `videoStitch` تنظیم نشده → برای بعضی بلاب‌ها در ترکیب با رفتار preload، چنک اول دانلود نمی‌شود
- بدون فراخوانی `v.load()` بعد از set کردن `src`، بعضی محیط‌ها lazy می‌مانند تا یک play trigger
- retry بدون فاصله زمانی → همان وضعیت مشکل‌دار GC/memory باقی‌ست

## رفع (حداقلی، جراحی، فقط ۲ فایل)

### A) `src/lib/videoStitch.ts` → تابع `preloadAndValidate` مقاوم‌سازی شود

تغییرات نقطه‌ای داخل تابع `load`:
1. صدا زدن صریح `v.load()` بعد از set کردن `v.src`.
2. پذیرش `loadeddata` به‌عنوان سیگنال موفقیت **علاوه بر** `loadedmetadata` (هر کدام زودتر آمد).
3. اگر `onerror` فایر شد ولی `videoWidth > 0` بود → موفق در نظر بگیر (خطای موقت decoder بعد از init).
4. افزایش timeout از ۱۵s به ۲۵s برای کلیپ‌های بعد از اولی.
5. بین retry اول و دوم یک `await sleep(400)` + **rebuild blob URL از همان Blob منبع** اگر در دسترس است (در غیر این صورت همان URL).
6. لاگ تشخیصی: قبل از reject، `console.error` با `blob URL prefix + videoWidth + readyState` تا debug آینده آسان شود.

### B) `src/components/ad-director/AutoEditDialog.tsx` → پاس دادن Blob خام

به جای ارسال فقط `blobUrl` به `stitchClips`، `blob` را هم در stitchInput نگه دار. سپس به `stitchClips` در `videoStitch.ts` یک شکل ورودی اختیاری اضافه‌ای پشتیبانی می‌کنیم: `{ videoUrl, targetDuration, blob? }`. اگر `blob` آمد و retry لازم شد، **یک `URL.createObjectURL(blob)` تازه ساخته شود** و دوباره load انجام شود (این رایج‌ترین راه‌حل برای بلاب‌های MediaRecorder که decoder روی URL اول مشکل پیدا می‌کند).

این کار backward compatible است: ad-director فعلی که فقط `videoUrl` می‌فرستد دست‌نخورده کار می‌کند.

### C) (محافظتی) `cutVideoIntoSegments` — اطمینان از فلاش کامل

در `src/lib/rawVideoUtils.ts`:
- بعد از `recorder.stop()` و قبل از `new Blob(chunks)`، یک `await new Promise(r => setTimeout(r, 80))` اضافه شود تا آخرین `dataavailable` chunk قطعاً برسد. این باگ MediaRecorder در chromium در ضبط‌های پشت سر هم رخ می‌دهد و chunk آخر گم می‌شود → blob خروجی corrupted.
- استفاده از `recorder.start(250)` به‌جای `100` برای کاهش تعداد chunkها و چنک‌های ناقص (mux تمیزتر).
- requestData قبل از stop: `try { recorder.requestData(); } catch {}` تا flush نهایی صریح باشد.

## محدوده تغییر

تغییر می‌کند:
- `src/lib/videoStitch.ts` — منطق `preloadAndValidate` و امضای داخلی `stitchClips` (افزودن فیلد `blob?` به ورودی)
- `src/lib/rawVideoUtils.ts` — فلاش امن MediaRecorder
- `src/components/ad-director/AutoEditDialog.tsx` — پاس دادن `blob` در stitchInput

تغییر **نمی‌کند:**
- AdDirector / Pro Editor (ورودی `blob?` اختیاری است)
- منطق `fitMode contain` و dims native
- silent-video-only policy
- هیچ edge function، DB، یا RLS

## مراحل اجرا

1. آپدیت `cutVideoIntoSegments`: `requestData` + flush delay + `start(250)`
2. آپدیت `preloadAndValidate` در `videoStitch.ts` با ۶ مورد بالا
3. اضافه کردن پشتیبانی `blob?` اختیاری در ورودی stitchClips → اگر retry لازم شد، URL تازه از blob ساخته شود
4. آپدیت `AutoEditDialog.tsx` برای پاس دادن `blob` در `stitchInput`
5. تست end-to-end با ۲ کلیپ ۲۰s (همان سناریوی خراب)

## اعتبارسنجی
- ✅ آپلود ۲+ کلیپ → خطای "Clip 2 failed to load after retry" دیگر رخ نمی‌دهد
- ✅ خروجی نهایی silent .mp4/.webm با ترتیب درست تولید می‌شود
- ✅ flow تک‌کلیپ بدون تغییر کار می‌کند
- ✅ AdDirector/Pro Editor دست‌نخورده باقی می‌ماند
- ✅ هیچ تغییری در edge function یا DB

