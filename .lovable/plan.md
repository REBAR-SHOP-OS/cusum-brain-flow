

# رفع خطای "Failed to send a request to the Edge Function" در Auto-Edit

## ریشه مشکل

دو علت محتمل، هر دو رفع می‌شود:

### ۱) Edge function هنوز deploy نشده
لاگ‌های `auto-video-editor` کاملاً خالی است — یعنی **هیچ درخواستی به function نرسیده**. این دقیقاً وقتی پیغام "Failed to send a request to the Edge Function" در client می‌آید، که خود function وجود ندارد یا deploy نشده. فایل `supabase/functions/auto-video-editor/index.ts` ساخته شده ولی هنوز روی edge runtime مستقر نیست.

### ۲) حجم body درخواست بیش از حد بزرگ
کلاینت ۲۴ keyframe به‌صورت base64 data URL در JSON می‌فرستد. هر فریم ~۳۰–۸۰KB، با inflation کل JSON راحت ۲–۳MB می‌شود. حد body در `supabase.functions.invoke` **۶MB** است. ممکن است گاهی به مرز برسد یا توسط CDN reject شود (که آن هم همان پیام "Failed to send" را تولید می‌کند).

## رفع

### A) Deploy کردن edge function
اجرای `supabase--deploy_edge_functions` با `["auto-video-editor"]` تا function روی edge runtime فعال شود.

### B) کاهش حجم payload در client
در `src/lib/rawVideoUtils.ts` تابع `extractKeyframes`:
- کاهش `targetWidth` از `320` به `224`
- کاهش JPEG quality از `0.7` به `0.55`
- کاهش پیش‌فرض `maxFrames` از `30` به `16`

در `src/components/ad-director/AutoEditDialog.tsx`:
- کاهش `maxFrames` از `24` به `12` (کافی برای scene detection)
- کاهش `intervalSec` از `2` به `dynamic` بر اساس مدت ویدیو

نتیجه: payload از ~۲–۳MB به ~۴۰۰–۸۰۰KB کاهش پیدا می‌کند.

### C) بهبود error handling
در `AutoEditDialog.handleFileSelected`:
- نمایش پیام واضح‌تر اگر `fnErr.message` شامل "Failed to send" باشد → پیشنهاد retry
- log کردن `frames.length` و حجم تقریبی برای debug آسان آینده

### D) اضافه کردن guard در edge function
در `supabase/functions/auto-video-editor/index.ts`:
- بررسی `req.headers.get("content-length")` در ابتدا و reject اگر > ۵MB با پیام واضح
- اضافه کردن `console.log` در ابتدای handler برای دیده شدن در logs (تأیید رسیدن request)

## محدوده تغییر

تغییر می‌کند:
- `src/lib/rawVideoUtils.ts` — کاهش پیش‌فرض‌های فریم
- `src/components/ad-director/AutoEditDialog.tsx` — کاهش تعداد فریم + بهبود error handling
- `supabase/functions/auto-video-editor/index.ts` — guard حجم + log ابتدایی
- Deploy: `auto-video-editor`

تغییر **نمی‌کند**:
- منطق scene detection / Gemini prompt
- silent-video-only policy
- bucket یا RLS
- بقیه flow Ad Director

## مراحل اجرا (پس از تأیید)

1. کاهش پیش‌فرض‌های keyframe در `rawVideoUtils.ts`
2. آپدیت `AutoEditDialog.tsx` با مقادیر کوچک‌تر و error message بهتر
3. اضافه کردن size guard + entry log به edge function
4. Deploy کردن `auto-video-editor`
5. تست end-to-end با یک ویدیو ۳۰ ثانیه‌ای

## اعتبارسنجی

- ✅ پس از deploy، logs `auto-video-editor` فعال می‌شود
- ✅ آپلود ویدیو → analysis بدون "Failed to send" کامل می‌شود
- ✅ Storyboard نمایش داده می‌شود
- ✅ خروجی silent .webm قابل دانلود است

