
هدف: رفع کامل مشکل «STILL SAME» برای نمایش نام کاربر زیر فیدبک در صفحه `/tasks`.

آنچه پیدا شد:
- تغییر قبلی فقط در لیست تسک‌های باز اعمال شده است.
- در بخش تسک‌های Completed هنوز کد قدیمی وجود دارد و مستقیم `task.created_by_profile.full_name` را نمایش می‌دهد.
- نتیجه: برای بخشی از تسک‌ها هنوز همان رفتار قبلی دیده می‌شود (خصوصاً جایی که نام creator روی "Ai" است یا creator واقعی در description/metadata است).

برنامه اجرا:

1) یکپارچه‌سازی نمایش نام در هر دو لیست Open و Completed
- فایل: `src/pages/Tasks.tsx`
- همان helper فعلی `getTaskCreatorName(task)` که برای لیست Open استفاده شده، در رندر Completed هم استفاده می‌شود.
- جایگزینی بلوک قدیمی خطوط Completed:
  - حذف:
    - `task.created_by_profile?.full_name`
  - افزودن:
    - `const name = getTaskCreatorName(task)` و نمایش `by {name}` در صورت وجود.

2) سخت‌کردن fallback برای تسک‌های فیدبک قدیمی/جدید
- فایل: `src/pages/Tasks.tsx`
- helper فعلی حفظ می‌شود ولی برای پایداری بهتر:
  - ابتدا `metadata.submitter_name`
  - سپس parse از `description` با `From: ...`
  - سپس `created_by_profile.full_name` (به‌جز "Ai")
- اگر هیچ‌کدام نبود، نمایش ندادن نام (به‌جای نام اشتباه).

3) بررسی سازگاری با داده‌های جدیدی که از AnnotationOverlay ذخیره می‌شوند
- فایل: `src/components/feedback/AnnotationOverlay.tsx`
- تأیید می‌شود که `metadata.submitter_name/submitter_email/submitter_profile_id` روی تسک‌های جدید ذخیره می‌شود (همان تغییری که قبلاً اعمال شده) تا از این به بعد نام همیشه قابل نمایش باشد.

4) اعتبارسنجی نهایی سناریوها
- سناریو A: تسک فیدبک جدید (با metadata) → نام واقعی نمایش داده شود.
- سناریو B: تسک فیدبک قدیمی (بدون metadata ولی با `From:`) → نام از description استخراج شود.
- سناریو C: تسک Completed همانند Open رفتار صحیح داشته باشد.
- سناریو D: اگر creator = "Ai" و fallback انسانی موجود است، نام انسانی نمایش داده شود.

ریسک و اثر:
- بدون تغییر دیتابیس.
- تغییر فقط در منطق نمایش UI است.
- اثر جانبی کم و محدود به صفحه Tasks.

خروجی مورد انتظار بعد از اعمال:
- دیگر هیچ بخشی از صفحه Tasks (نه Open و نه Completed) نام "Ai" را به‌جای نام واقعی submitter فیدبک نشان ندهد، مگر واقعاً submitter ناشناخته باشد.
