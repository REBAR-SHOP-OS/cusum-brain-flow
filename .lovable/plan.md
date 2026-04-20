

# آپلود ویدیو خام و ادیت + خروجی خودکار

## جواب کوتاه
**بله، کاملاً امکان‌پذیر است** — حتی الان زیرساخت لازم برای اکثر این کار موجود است.  
شما الان می‌توانید ویدیو آپلود کنید، اما فقط جایگزین یک scene می‌شود. کاری که شما می‌خواهید این است:  
**یک ویدیو بفرستید → هوش‌مصنوعی خودش آن را به صحنه‌ها برش بزند → ادیت کند → خروجی نهایی بدهد.**

## وضعیت فعلی Ad Director

✅ **آماده است:**
- آپلود فایل ویدیو/تصویر در تب Media (`MediaTab.tsx` — موجود)
- موتور stitch ویدیو (`videoStitch.ts` — برش، crossfade، overlay، voiceover، music)
- پایپ‌لاین رندر (`useRenderPipeline.ts`)
- ذخیره در bucket `generated-videos`
- ادیتور حرفه‌ای (`ProVideoEditor.tsx` — ۱۲ تب: media, text, music, brand-kit, ...)
- Edge function `edit-video-prompt` (برای ادیت‌های توصیفی)
- Edge function `video-to-social` (برای تولید خودکار کپشن)

❌ **چیزی که الان وجود ندارد:**
- اتوماسیون **«یک ویدیو خام بفرست → AI خودش بقیه را انجام دهد»**
- تشخیص خودکار صحنه‌ها (scene detection) از روی یک ویدیوی تک‌تکه
- زنجیره خودکار `analyze → cut → enhance → assemble → export`

## پلن پیشنهادی

یک flow جدید اضافه می‌کنیم به نام **"Auto-Edit from Raw Video"** که در `/ad-director` کنار flow فعلی قرار می‌گیرد.

### مرحله‌های flow جدید

```text
[1] User uploads raw video (mp4, mov, max 200MB)
        ↓
[2] Upload to Supabase Storage (bucket: raw-uploads)
        ↓
[3] Edge function: analyze-raw-video
    - Extract metadata (duration, resolution, fps) با Mediabunny
    - Generate frame thumbnails هر ۲ ثانیه
    - ارسال thumbnailها به Gemini 2.5 Flash برای:
        • تشخیص scene breaks
        • توضیح هر صحنه
        • پیشنهاد ترتیب بهتر
        • پیشنهاد ادیت‌های بهبود (rate, transition, color)
        ↓
[4] Frontend: نمایش storyboard پیشنهادی AI
    User می‌تواند:
        - تأیید کند (auto-edit)
        - دستی ویرایش کند (manual override)
        ↓
[5] Edge function: process-video-segments
    - برش video با MediaRecorder/ffmpeg.wasm در browser
    - ساخت segmentهای جداگانه
        ↓
[6] Run موجود stitchClips() با:
    - segmentهای cut شده
    - transition پیش‌فرض (Crossfade 0.5s)
    - voiceover اختیاری (TTS)
    - music اختیاری (از Brand Kit)
    - logo overlay
        ↓
[7] خروجی .mp4 → upload به generated-videos bucket
        ↓
[8] نمایش لینک دانلود + auto-trigger video-to-social برای caption
```

### تغییرات فنی (مینیمال و افزایشی)

#### ۱) UI جدید
فایل جدید: `src/components/ad-director/RawVideoUploader.tsx`
- یک کارت در ابتدای `/ad-director`
- دکمه «Upload raw video — let AI edit it»
- progress bar برای آپلود + analysis
- نمایش storyboard پیشنهادی AI با thumbnail‌ها

اضافه به `AdDirectorContent.tsx`:
- یک tab/mode جدید: "Auto-Edit from Video"

#### ۲) Storage Bucket جدید
- bucket: `raw-uploads` (private, RLS با user_id)
- TTL خودکار ۲۴ ساعت (cleanup cron)
- محدودیت حجم: ۲۰۰MB

#### ۳) Edge Function جدید: `auto-video-editor`
مسیر: `supabase/functions/auto-video-editor/index.ts`

- **action: "analyze"**:
  - دریافت `videoUrl`
  - استخراج ۱ فریم در ثانیه با Mediabunny
  - ارسال batch فریم‌ها به Gemini Flash (vision) برای scene detection
  - برگشت: `{ scenes: [{ start, end, description, suggested_action }] }`

- **action: "auto-script"**:
  - دریافت scene descriptions
  - تولید کپشن، voiceover، music suggestion
  - برگشت: storyboard آماده

#### ۴) Browser-side Video Cutting
کتابخانه: استفاده از همان `videoStitch.ts` با تغییر کوچک
- اضافه کردن helper جدید `cutVideoIntoSegments(file, cuts)` در `src/lib/videoStitch.ts`
- خروجی: آرایه‌ای از Blob URL برای segmentها
- سپس مستقیم تغذیه به `stitchClips()` موجود

#### ۵) Pipeline Wiring
در `useRenderPipeline.ts`:
- اضافه کردن phase جدید `analyzing_raw` قبل از `scenes_ready`
- بقیه pipeline دست نمی‌خورد

### مدل AI استفاده‌شده
- **Scene detection**: `gemini-2.5-flash` (vision) — ارزان و سریع، مستقیم از کلید Gemini شما
- **Script generation**: `gemini-2.5-flash` — مسیر فعلی Lovable Gateway
- **هیچ مدل گران‌قیمتی استفاده نمی‌شود**

### محدودیت‌های مهم

⚠️ **برش ویدیو در browser محدودیت دارد:**
- ویدیوهای بالای ۱۰۰MB ممکن است memory crash بدهند
- برای ویدیوهای بزرگ‌تر، نیاز به ffmpeg.wasm یا edge-side processing است
- در فاز اول: **محدودیت ۱۰۰MB روی فایل آپلودی**

⚠️ **پردازش طولانی:**
- analysis یک ویدیوی ۵ دقیقه‌ای حدود ۳۰–۶۰ ثانیه طول می‌کشد
- نیاز به Wake Lock (که قبلاً در کد هست) + progress bar روشن

⚠️ **کیفیت scene detection:**
- در فاز اول، AI صحنه‌ها را بر اساس visual change تشخیص می‌دهد
- برای کیفیت بهتر، می‌توان later فاز ۲ یا audio-based detection اضافه کرد

### چیزی که عوض **نمی‌شود**

- هیچ تغییر در flow فعلی Ad Director (ساخت ویدیو از prompt)
- هیچ تغییر در `AdDirectorContent`، `ChatPromptBar`، `ProVideoEditor`
- هیچ تغییر در RLS، database entities موجود
- بقیه ۱۸ agent بدون تغییر

### مراحل اجرا (پس از تأیید)

1. ساخت bucket `raw-uploads` با migration + RLS policy
2. ساخت edge function `auto-video-editor` با ۲ action
3. اضافه کردن `cutVideoIntoSegments()` به `videoStitch.ts`
4. ساخت کامپوننت `RawVideoUploader.tsx`
5. wire کردن به `AdDirectorContent.tsx` به‌عنوان mode دوم
6. تست end-to-end:
   - آپلود یک ویدیو ۳۰ ثانیه‌ای → analysis → storyboard → export
   - بررسی خروجی .mp4 و قابلیت دانلود

### اعتبارسنجی

- ✅ ویدیوی ۳۰ ثانیه‌ای آپلود و analyze شود (<۳۰ ثانیه)
- ✅ Storyboard پیشنهادی نمایش داده شود
- ✅ خروجی نهایی .mp4 قابل پخش باشد
- ✅ caption خودکار برای social media تولید شود
- ✅ flow قدیمی (text-to-video) دست‌نخورده باقی بماند

### تخمین زمان
- یک نسخه قابل‌استفاده (MVP): چند ساعت کار توسعه
- نسخه pro با ffmpeg.wasm برای فایل‌های بزرگ: فاز ۲

### سوال قبل از شروع
آیا فاز ۱ (تا ۱۰۰MB، browser-side) برای شما کافی است یا از همان اول می‌خواهید با ffmpeg.wasm کار کنیم تا فایل‌های بزرگ‌تر هم پشتیبانی شوند؟

