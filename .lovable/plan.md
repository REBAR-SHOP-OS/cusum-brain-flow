

# Regenerate Auto-Edit با پرامت کاربر

## هدف
در صفحه‌ی "done" (بعد از Download Video)، یک باکس prompt اضافه شود تا کاربر بنویسد چه تغییری در ادیت می‌خواهد (مثلاً "صحنه‌های اکشن بیشتر، کات‌های سریع‌تر، فقط بخش thumbs-up را نگه دار") و دکمه‌ی **Regenerate**. خروجی جدید با همان فایل‌های منبع و keyframes قبلی، اما با storyboard متفاوت بر اساس راهنمایی کاربر، تولید می‌شود.

## رفتار

**در صفحه done:**
- زیر دکمه Download، یک کارت با `Textarea` (placeholder: "مثلاً: صحنه‌های پرحرکت‌تر را انتخاب کن، کات‌ها سریع‌تر باشد")
- دکمه‌ی **"Regenerate with this prompt"** (بنفش/امبر، با آیکون `Sparkles`)
- وقتی کلیک شد:
  1. UI به phase `analyzing` برمی‌گردد با پیام "Re-editing with your direction…"
  2. همان keyframes قبلی (cache شده) + پرامت کاربر دوباره به edge function ارسال می‌شود
  3. storyboard جدید برمی‌گردد → مستقیم وارد `generating` می‌شود (بدون نمایش review، چون کاربر قبلاً ساخته)
  4. ویدیوی نهایی جدید نمایش داده می‌شود؛ ویدیوی قبلی revoke می‌شود
- دکمه‌ی **"Edit storyboard manually"** هم اضافه شود برای کسی که می‌خواهد به جای regenerate، storyboard را دستی ویرایش کند → برمی‌گردد به phase `review`.

**Cache:**
- در state یک `clipsPayloadRef` نگه‌داری می‌شود (همان keyframes استخراج‌شده در آپلود اول) تا re-extract لازم نباشد.
- هر بار regenerate، فقط فراخوانی edge function + cut/stitch جدید — extraction دوباره انجام نمی‌شود.

## تغییرات فنی

### `supabase/functions/auto-video-editor/index.ts`
- پذیرش فیلد جدید `userDirection?: string` در body
- اگر آمد، در prompt تزریق شود:
  > `USER DIRECTION (highest priority): "${userDirection}". Re-edit accordingly while still following the rules above.`
- بقیه‌ی منطق بدون تغییر. backward compatible.
- redeploy edge function.

### `src/components/ad-director/AutoEditDialog.tsx`
- state جدید:
  - `clipsPayloadRef = useRef<ClipPayload[] | null>(null)` — ذخیره keyframes برای reuse
  - `regeneratePrompt: string`
- در `handleFilesSelected`: بعد از ساخت `clipsPayload`، آن را در ref ذخیره کن.
- تابع جدید `handleRegenerate(direction: string)`:
  - اگر `clipsPayloadRef.current` خالی است → toast خطا
  - phase = `analyzing`, پیام "Re-editing with your direction…"
  - فراخوانی edge function با `{ action: "analyze", clips: cached, userDirection: direction }`
  - بعد از دریافت scenes جدید → `setScenes(...)` و مستقیم `handleGenerate()` صدا زده شود (نه نمایش review)
  - ویدیوی قبلی revoke شود
- در بخش `phase === "done"`:
  - زیر دکمه‌های فعلی، یک panel اضافه شود:
    - `<Textarea>` برای پرامت
    - `<Button>` "Regenerate with this prompt" (disabled وقتی textarea خالی است)
    - لینک متنی "Edit storyboard manually" → `setPhase("review")`

### بدون تغییر
- `AutoEditUploadStep`, `AutoEditStoryboardStep`
- `cutVideoIntoSegments`, `stitchClips`
- silent-video-only policy
- bucket / RLS

## محدوده تغییر

تغییر می‌کند:
- `src/components/ad-director/AutoEditDialog.tsx` (افزودن regenerate UI + cache + handler)
- `supabase/functions/auto-video-editor/index.ts` (پذیرش `userDirection` و تزریق در prompt) + redeploy

تغییر **نمی‌کند:**
- بقیه‌ی Auto-Edit flow (upload, storyboard editor, generate, stitch)
- Ad Director یا Pro Editor
- منطق native dims / fitMode contain

## مراحل اجرا

1. آپدیت edge function برای پشتیبانی از `userDirection` و redeploy
2. آپدیت `AutoEditDialog.tsx`:
   - cache کردن `clipsPayload` در ref
   - افزودن `regeneratePrompt` state
   - افزودن `handleRegenerate` که از کش استفاده می‌کند
   - افزودن UI پرامت + دکمه در بخش done
3. تست end-to-end:
   - یک ویدیو آپلود → ادیت ساخته شود
   - در done، پرامت بزن: "صحنه‌های آخر را حذف کن"
   - regenerate → ویدیوی جدید با storyboard متفاوت

## اعتبارسنجی
- ✅ بعد از ساخت اولین ویدیو، باکس پرامت زیر دکمه Download نمایش داده می‌شود
- ✅ نوشتن پرامت + کلیک Regenerate → بدون آپلود مجدد، ویدیوی جدید با storyboard متفاوت ساخته می‌شود
- ✅ ویدیوی قبلی به‌درستی revoke می‌شود (بدون memory leak)
- ✅ "Edit storyboard manually" کاربر را به phase review برمی‌گرداند
- ✅ پرامت خالی → دکمه disabled
- ✅ flow اولیه (آپلود اول) دست‌نخورده باقی می‌ماند

