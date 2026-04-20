

# اضافه کردن دکمه "Auto-Edit" برای آپلود ویدیوی خام

## هدف
یک action جدید کنار **AI Prompt** و **Character** در composer صفحه `/ad-director` اضافه می‌شود (موقعیت دایره قرمز در اسکرین‌شات). کلیک روی این دکمه یک صفحه/مودال تمام‌صفحه باز می‌کند که flow کامل **آپلود ویدیوی خام → آنالیز AI → ادیت خودکار → خروجی** را در خود دارد.

## مکان دکمه
در `src/components/ad-director/ChatPromptBar.tsx` بین دکمه `AI Prompt` (خط ۷۲۹) و `Character` (خط ۷۴۶) یک دکمه جدید با همان استایل اضافه می‌شود:

```text
[ ✨ AI Prompt ]   [ 🎬 Auto-Edit ]   [ 👤 Character ]   [ Create video ➤ ]
```

- آیکون: `Wand2` یا `Film` (Lucide)
- متن: **"Auto-Edit"** + tooltip: "Upload raw video and let AI edit it for you"
- استایل: `border-emerald-400/40 bg-emerald-400/10 text-emerald-200` (تا از سایر دکمه‌ها متمایز باشد و حس "جدید" بدهد)
- یک badge کوچک "NEW" در گوشه بالا-راست دکمه (اختیاری)

## کامپوننت جدید
فایل جدید: `src/components/ad-director/AutoEditDialog.tsx`

یک Dialog تمام‌صفحه (`Dialog` از shadcn، `max-w-5xl h-[90vh]`) با ۵ مرحله:

1. **Upload** — drop zone + button (mp4/mov، ≤۱۰۰MB، یک ویدیو در هر بار)
2. **Analyzing** — progress bar + پیام "AI is watching your video..." با thumbnail‌های استخراج‌شده
3. **Storyboard Review** — لیست صحنه‌های پیشنهادی AI با thumbnail، توضیح، مدت، و قابلیت drag-to-reorder + delete
4. **Generating** — progress bar مرحله render
5. **Done** — preview ویدیوی نهایی + دکمه Download + دکمه "Send to Editor" (انتقال به ProVideoEditor برای fine-tune)

## Flow (همان plan قبلی، فشرده)

```text
[1] User clicks "Auto-Edit" → Dialog باز می‌شود
[2] User آپلود می‌کند (drag-drop یا کلیک) → upload به bucket raw-uploads
[3] Edge function auto-video-editor (action: "analyze")
    → استخراج فریم با Mediabunny هر ۲ ثانیه
    → ارسال به Gemini 2.5 Flash (vision) برای scene detection
    → برگشت [{ start, end, description, thumbnailUrl }]
[4] Storyboard review در dialog نمایش داده می‌شود
[5] User دکمه "Generate Final Video" را می‌زند
[6] cutVideoIntoSegments() در browser → segmentها
[7] stitchClips() موجود (silent — بدون audio طبق rule)
[8] خروجی .mp4 → bucket generated-videos
[9] preview + download
```

## تغییرات فنی

### فایل‌های جدید
- `src/components/ad-director/AutoEditDialog.tsx` — کل UI و state machine
- `src/components/ad-director/AutoEditUploadStep.tsx` — drop zone
- `src/components/ad-director/AutoEditStoryboardStep.tsx` — لیست صحنه‌ها
- `supabase/functions/auto-video-editor/index.ts` — analyze + auto-script
- یک migration برای bucket `raw-uploads` (private، RLS بر اساس `auth.uid()`، حداکثر ۱۰۰MB، TTL ۲۴ ساعت)

### فایل‌های تغییریافته
- `src/components/ad-director/ChatPromptBar.tsx` — اضافه کردن دکمه + state `autoEditOpen`
- `src/lib/videoStitch.ts` — اضافه کردن helper `cutVideoIntoSegments(file, cuts)` (افزایشی، بقیه دست‌نخورده)

### قانون مهم — رعایت Silent Video Policy
طبق memory rule موجود (`silent-video-only-policy`):
- ✅ خروجی Auto-Edit بدون صدا و بدون موزیک خواهد بود
- ✅ از branch silent در `stitchClips` استفاده می‌شود
- ✅ هیچ TTS یا music در این flow صدا زده نمی‌شود
- ✅ حتی audio تعبیه‌شده در ویدیوی خام آپلودی هم در خروجی نهایی حذف می‌شود

### مدل AI
- `google/gemini-2.5-flash` (vision) — مستقیم از کلید Gemini موجود (طبق memory `ai-routing-cost-strategy`)
- بدون مدل گران‌قیمت

## محدوده تغییر

تغییر می‌کند:
- اضافه شدن یک دکمه به composer
- ۳ کامپوننت جدید (Dialog + ۲ step)
- ۱ edge function جدید
- ۱ helper جدید در `videoStitch.ts`
- ۱ bucket جدید + RLS

تغییر **نمی‌کند**:
- flow فعلی Ad Director (text → video)
- `AdDirectorContent`، `ProVideoEditor`، `useRenderPipeline`
- منطق scenes، prompt engineering، یا history
- RLS سایر جداول، database entities موجود
- silent-video policy — کاملاً رعایت می‌شود

## محدودیت‌های فاز ۱
- حداکثر **۱۰۰MB** فایل (بزرگ‌تر در فاز ۲ با ffmpeg.wasm)
- ویدیوهای ۳۰ ثانیه تا ۵ دقیقه — analyzing ~۳۰–۶۰ ثانیه
- حداکثر ۱۲ صحنه پیشنهادی AI

## مراحل اجرا (پس از تأیید)
1. ساخت bucket `raw-uploads` با RLS
2. ساخت edge function `auto-video-editor` (action: analyze)
3. اضافه کردن `cutVideoIntoSegments()` به `videoStitch.ts`
4. ساخت `AutoEditDialog.tsx` + ۲ step component
5. اضافه کردن دکمه Auto-Edit به `ChatPromptBar.tsx` بین AI Prompt و Character
6. تست end-to-end با یک ویدیو ۳۰ ثانیه‌ای

## اعتبارسنجی
- ✅ دکمه Auto-Edit در محل دایره قرمز در اسکرین‌شات نمایش داده می‌شود
- ✅ کلیک → Dialog باز می‌شود
- ✅ آپلود ویدیو → analysis < ۶۰ ثانیه
- ✅ Storyboard نمایش داده می‌شود و قابل ویرایش است
- ✅ خروجی نهایی .mp4 silent (بدون صدا/موزیک) و قابل دانلود
- ✅ flow فعلی Ad Director دست‌نخورده باقی می‌ماند
- ✅ silent-video-only policy رعایت می‌شود

