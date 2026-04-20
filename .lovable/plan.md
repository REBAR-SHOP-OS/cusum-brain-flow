

# پشتیبانی از آپلود چند ویدیو در Auto-Edit

## هدف
الان فقط یک ویدیو در هر بار قابل آپلود است. کاربر می‌خواهد **چند ویدیو** آپلود کند تا AI همه را با هم آنالیز کند، صحنه‌های بهترین را از کل کلیپ‌ها انتخاب کند و یک ادیت نهایی silent بسازد.

## رفتار جدید

**Upload step:**
- پشتیبانی از multi-file (drop چند فایل یا انتخاب چندتایی)
- نمایش لیست فایل‌های انتخاب‌شده با thumbnail کوچک، نام، حجم، مدت، و دکمه حذف
- مجموع حجم ≤ ۲۰۰MB (بجای ۱۰۰MB برای یک فایل)
- حداکثر **۵ ویدیو** در هر batch
- دکمه "Add more" برای اضافه کردن کلیپ بیشتر بدون از دست دادن قبلی‌ها

**Analyzing step:**
- برای هر ویدیو جداگانه keyframe extract می‌شود (۸ فریم برای هر کلیپ تا کل payload کوچک بماند)
- همه فریم‌ها با یک فراخوانی به edge function `auto-video-editor` ارسال می‌شوند
- Gemini از کل کلیپ‌ها بهترین صحنه‌ها را انتخاب و ترتیب پیشنهادی می‌دهد
- progress bar مرحله‌ای: "Analyzing clip 2 of 4..."

**Storyboard step:**
- هر صحنه با badge منبع (مثلاً "Clip 2 · 0:14–0:21") نمایش داده می‌شود
- درگ برای reorder + delete (همان رفتار فعلی)
- نمایش thumbnail اولین فریم هر صحنه

**Generating step:**
- `cutVideoIntoSegments` برای هر کلیپ منبع جداگانه اجرا می‌شود
- segmentها با ترتیب storyboard به `stitchClips()` (silent branch) داده می‌شوند
- خروجی نهایی .webm/.mp4 silent

## تغییرات فنی

### `src/components/ad-director/AutoEditUploadStep.tsx`
- تبدیل state از `file: File | null` به `files: File[]`
- input با `multiple` attribute
- لیست فایل‌ها با thumbnail (از `URL.createObjectURL` فریم اول)
- validation: تعداد ≤۵، مجموع حجم ≤۲۰۰MB، هر فایل ≤۱۰۰MB
- callback `onFilesSelected(files: File[])`

### `src/components/ad-director/AutoEditDialog.tsx`
- state: `sourceFiles: File[]` بجای `sourceFile`
- `handleFilesSelected`: حلقه روی هر فایل، استخراج ۸ keyframe، ارسال یک‌جا با metadata `{ clipIndex, clipDuration, frames }[]`
- progress callback مرحله‌ای برای UI
- در generate: حلقه روی scenes، برای هر scene از فایل منبع درست `cutVideoIntoSegments` صدا زده می‌شود
- map کردن `clipIndex` در storyboard scene به فایل منبع

### `src/lib/rawVideoUtils.ts`
- `extractKeyframes` بدون تغییر — فقط برای هر فایل جداگانه صدا زده می‌شود
- اضافه کردن helper `cutSegmentFromFile(file, start, end)` که segment را از فایل خاص می‌برد (در صورت لزوم)

### `supabase/functions/auto-video-editor/index.ts`
- پذیرش payload جدید: `{ clips: [{ index, duration, frames: string[] }] }` به‌جای `{ frames: string[] }`
- prompt به Gemini: تأکید بر انتخاب بهترین صحنه‌ها از **بین چند کلیپ** و برگشت `clipIndex` در هر scene
- خروجی: `{ scenes: [{ clipIndex, start, end, description, thumbnailUrl }] }`
- backward compatibility: اگر `frames` تنها بیاید، مثل قبل با `clipIndex=0` رفتار کند
- size guard همچنان ۵MB

### `src/components/ad-director/AutoEditStoryboardStep.tsx`
- نمایش badge "Clip {clipIndex + 1}" روی هر صحنه
- بقیه رفتار بدون تغییر

## محدوده تغییر

تغییر می‌کند:
- ۳ فایل UI (`AutoEditUploadStep`, `AutoEditDialog`, `AutoEditStoryboardStep`)
- ۱ edge function (`auto-video-editor`) + redeploy
- ۱ helper اضافه در `rawVideoUtils.ts`

تغییر **نمی‌کند:**
- silent-video-only policy (همچنان بدون صدا)
- bucket `raw-uploads` یا RLS
- دکمه Auto-Edit در `ChatPromptBar`
- منطق `stitchClips`
- بقیه flow Ad Director

## محدودیت‌ها (فاز ۱)
- حداکثر **۵ کلیپ** در هر batch
- مجموع حجم ≤ **۲۰۰MB**
- هر فایل تکی ≤ ۱۰۰MB
- analysis یک batch ۵ کلیپه ~۶۰–۹۰ ثانیه

## مراحل اجرا (پس از تأیید)

1. آپدیت `AutoEditUploadStep.tsx` برای multi-file
2. آپدیت `AutoEditDialog.tsx` برای loop آپلود/keyframe و ارسال batch
3. آپدیت edge function برای پذیرش `clips[]` و برگرداندن `clipIndex`
4. Redeploy `auto-video-editor`
5. آپدیت `AutoEditStoryboardStep.tsx` برای نمایش clip badge
6. تست end-to-end با ۲ کلیپ ۲۰ ثانیه‌ای

## اعتبارسنجی
- ✅ کاربر می‌تواند ۲–۵ ویدیو را drop یا انتخاب کند
- ✅ لیست فایل‌ها با thumbnail و دکمه حذف نمایش داده می‌شود
- ✅ analysis روی همه کلیپ‌ها انجام می‌شود و storyboard ترکیبی برمی‌گردد
- ✅ هر scene نشان می‌دهد از کدام clip منبع آمده
- ✅ خروجی نهایی silent .mp4/.webm با ترتیب درست
- ✅ flow تک‌فایل قبلی همچنان کار می‌کند (backward compatible)

