

# بررسی عمیق مشکلات زمان‌بندی و انتشار پست‌های سوشیال مدیا

## مشکلات شناسایی‌شده

### ۱. مشکل بحرانی: Cron Publish صفحه (`page_name`) را نادیده می‌گیرد
**فایل:** `supabase/functions/social-cron-publish/index.ts` (خط 94)
- همیشه `pages[0]` را انتخاب می‌کند — حتی اگر پست برای صفحه دیگری (مثلاً Rebar.shop) باشد
- `social-publish` این مشکل را ندارد چون `page_name` را دریافت و match می‌کند
- **نتیجه:** پست‌های زمان‌بندی‌شده همیشه روی اولین صفحه منتشر می‌شوند

### ۲. مشکل بحرانی: SchedulePopover صفحه را ذخیره نمی‌کند
**فایل:** `src/components/social/SchedulePopover.tsx` (خط 51-58)
- هنگام schedule کردن، `page_name` در update ارسال نمی‌شود
- وقتی cron اجرا شود، `page_name` خالی است و به `pages[0]` fallback می‌کند

### ۳. مشکل: DateSchedulePopover هم `page_name` ذخیره نمی‌کند
**فایل:** `src/components/social/PostReviewPanel.tsx` (خط 430-432)
- `onSetDate` فقط `scheduled_date` و `status` را آپدیت می‌کند
- `page_name` و `qa_status` ذخیره نمی‌شوند

### ۴. مشکل: انتخاب چند پلتفرم فقط اولی ذخیره می‌شود
**فایل:** `src/components/social/SchedulePopover.tsx` (خط 57)
- `platform: selectedPlatforms[0]` — اگر کاربر 3 پلتفرم انتخاب کند، فقط اولی ذخیره می‌شود
- برای بقیه پلتفرم‌ها پست duplicate ساخته نمی‌شود

### ۵. مشکل جزئی: `qa_status` ناسازگار
- `SchedulePopover` مقدار `qa_status: "approved"` ست می‌کند
- `DateSchedulePopover` اصلاً `qa_status` ست نمی‌کند

---

## راه‌حل‌ها

### ۱. اصلاح `social-cron-publish` — استفاده از `page_name` پست
```typescript
// به جای pages[0]، page_name پست را match کن
let selectedPage = pages[0];
if (post.page_name) {
  const matched = pages.find((p) => p.name === post.page_name);
  if (matched) selectedPage = matched;
}
```

### ۲. اصلاح `SchedulePopover` — ارسال `page_name` هنگام schedule
در `handleConfirm`، مقدار `page_name` فعلی پست را نیز شامل کنیم.

### ۳. اصلاح `PostReviewPanel` — ارسال `page_name` و `qa_status` در `onSetDate`
```typescript
onSetDate={(date) => {
  updatePost.mutate({
    id: post.id,
    scheduled_date: date.toISOString(),
    status: "scheduled",
    qa_status: "scheduled",
  });
}}
```
و `localPages` را به `SchedulePopover` پاس بدهیم.

### ۴. اصلاح `SchedulePopover` — ساخت پست‌های duplicate برای چند پلتفرم
اگر بیش از یک پلتفرم انتخاب شود، برای هر پلتفرم اضافی یک پست جدید (کپی) ایجاد شود.

---

## فایل‌های تغییر
1. `supabase/functions/social-cron-publish/index.ts` — match کردن `page_name`
2. `src/components/social/SchedulePopover.tsx` — ذخیره `page_name` + ساخت duplicate برای multi-platform
3. `src/components/social/PostReviewPanel.tsx` — پاس دادن `localPages` و اصلاح `qa_status`

