

## ایجاد حلقه تأیید فیدبک در بورد تسک‌ها

### مشکل فعلی
وقتی Radin یا Sattar یک تسک فیدبک را حل می‌کنند، فقط یک نوتیفیکیشن به سازنده اصلی ارسال می‌شود. سازنده باید از طریق Inbox تأیید یا ریپورت مجدد کند. اما در بورد تسک‌ها (Employee Tasks)، تسک فقط در ستون Radin/Sattar نمایش داده می‌شود و سازنده اصلی آن را در ستون خودش نمی‌بیند.

### راه‌حل
وقتی Radin/Sattar یک تسک فیدبک (`source = "screenshot_feedback"`) را complete می‌کنند، یک **تسک تأیید جدید** در ستون سازنده اصلی ایجاد شود. این تسک:
- عنوان: `✅ بازخورد شما بررسی شد: [عنوان اصلی]`
- assigned_to: سازنده اصلی (created_by_profile_id)
- source: `feedback_verification`
- metadata شامل task_id اصلی و اطلاعات مورد نیاز برای re-report

سپس در UI بورد تسک، تسک‌های با source `feedback_verification` با دو دکمه اختصاصی نمایش داده شوند:
- **تیک سبز**: تأیید رفع مشکل (تسک complete می‌شود)
- **بازگزارش قرمز**: مشکل حل نشده → تسک جدید با اولویت بالا برای Radin/Sattar ایجاد می‌شود

### تغییرات فایل

**1. `src/pages/Tasks.tsx`**

**الف) تغییر در `toggleComplete`** (حوالی خط 530-555):
- وقتی یک تسک فیدبک (`source === "screenshot_feedback"`) complete می‌شود، علاوه بر notification فعلی، یک تسک جدید با `source: "feedback_verification"` ایجاد شود و `assigned_to` آن برابر `created_by_profile_id` تسک اصلی باشد.
- metadata تسک جدید شامل: `original_task_id`, `original_title`, `original_description`, `original_attachment_url`

**ب) اضافه کردن دو تابع جدید:**
- `confirmFeedbackFix(task)`: تسک verification را complete می‌کند (تیک سبز)
- `reReportFeedback(task)`: تسک جدید با اولویت بالا برای Radin ایجاد می‌کند، تسک verification را complete می‌کند (بازگزارش)

**ج) تغییر در UI رندر تسک‌ها** (حوالی خط 856-900):
- برای تسک‌های با `source === "feedback_verification"`:
  - پس‌زمینه متفاوت (مثلاً سبز ملایم) برای تشخیص بصری
  - به جای Checkbox معمولی، دو آیکون نمایش داده شود:
    - دکمه تیک سبز (Check) برای تأیید
    - دکمه بازگزارش قرمز (RefreshCw) برای گزارش مجدد
  - عنوان تسک با نشانه بصری خاص

### جریان کامل

```text
1. کاربر A فیدبک ارسال می‌کند → تسک در ستون Radin ایجاد می‌شود
2. Radin تسک را complete می‌کند → 
   a. نوتیفیکیشن به کاربر A (مثل قبل)
   b. تسک verification در ستون کاربر A ایجاد می‌شود (جدید)
3. کاربر A در بورد تسک خودش:
   a. تیک سبز → تسک بسته می‌شود ✓
   b. بازگزارش → تسک جدید در ستون Radin با اولویت بالا ایجاد می‌شود
```

### جزئیات فنی

| تغییر | فایل | خطوط تقریبی |
|--------|------|-------------|
| ایجاد تسک verification هنگام complete شدن فیدبک | Tasks.tsx | 530-555 (toggleComplete) |
| تابع confirmFeedbackFix | Tasks.tsx | جدید، بعد از toggleComplete |
| تابع reReportFeedback | Tasks.tsx | جدید، بعد از confirmFeedbackFix |
| UI اختصاصی feedback_verification | Tasks.tsx | 856-900 (رندر تسک‌ها) |

بدون نیاز به تغییر دیتابیس — از فیلدهای موجود `source` و `metadata` (JSONB) استفاده می‌شود.
