
## نمایش نام واقعی ایجادکننده در کارت‌های تسک

### مشکل
در صفحه `/tasks`، تسک‌های فیدبک "by Ai" نشان می‌دهند چون `created_by_profile_id` به پروفایل "Ai" (ai@rebar.shop) اشاره دارد. همچنین حدود نیمی از تسک‌ها اصلاً `created_by_profile_id` ندارند و نام ایجادکننده نمایش داده نمی‌شود.

### راه‌حل

#### 1. تغییر در `src/components/feedback/AnnotationOverlay.tsx`
- فیلد `metadata` به insert تسک اضافه شود تا نام و ایمیل فرستنده به صورت ساختاریافته ذخیره شود:
  ```typescript
  metadata: JSON.stringify({
    submitter_name: submitterName,
    submitter_email: user?.email,
    submitter_profile_id: submitterProfileId,
  })
  ```

#### 2. تغییر در `src/pages/Tasks.tsx` - نمایش نام ایجادکننده
- در بخش نمایش کارت تسک (خطوط 982-987)، منطق نمایش نام را بهبود دهیم:
  - اگر تسک `source === "screenshot_feedback"` باشد و `metadata` شامل `submitter_name` باشد، آن نام را نشان بده
  - اگر `created_by_profile.full_name` برابر "Ai" باشد، از فیلد `From:` در description نام را استخراج کن (fallback)
  - در غیر این صورت `created_by_profile.full_name` عادی نشان داده شود

#### 3. تابع کمکی `extractSubmitterName`
- یک تابع helper اضافه شود که از description تسک‌های فیدبک، نام فرستنده (`From: ...`) را parse کند
- این برای تسک‌های قدیمی که metadata ندارند کار می‌کند

### جزئیات فنی

**فایل‌های تغییر:**
1. `src/components/feedback/AnnotationOverlay.tsx` - اضافه کردن metadata به insert
2. `src/pages/Tasks.tsx` - بهبود منطق نمایش نام ایجادکننده

**بدون تغییر دیتابیس** - فیلد `metadata` قبلاً در جدول tasks وجود دارد (به صورت jsonb).

**منطق نمایش نام:**
```text
1. اگر metadata.submitter_name موجود باشد -> آن را نشان بده
2. اگر description شامل "From: ..." باشد -> نام را از آن استخراج کن
3. اگر created_by_profile.full_name موجود باشد -> آن را نشان بده
4. در غیر این صورت -> چیزی نشان نده
```
