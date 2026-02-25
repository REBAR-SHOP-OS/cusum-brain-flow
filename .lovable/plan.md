

## فیلتر فیدبک‌ها: فقط به Radin و حذف از ستون Sattar

### مشکل فعلی
- فیدبک‌های کاربران (با عنوان "Feedback:") به هر دو Radin و Zahra ارسال می‌شود
- ستون Sattar در صفحه Tasks ممکن است فیدبک‌های قدیمی یا اشتباهی را نمایش دهد

### تغییرات

**1. `src/components/feedback/AnnotationOverlay.tsx`**
- حذف `ZAHRA_PROFILE_ID` از آرایه `FEEDBACK_RECIPIENTS`
- فیدبک‌ها فقط برای Radin ایجاد شوند
- نوتیفیکیشن هم فقط برای Radin ارسال شود

**2. `src/pages/Tasks.tsx`**
- ثابت `SATTAR_PROFILE_ID = "ee659c5c-20e1-4bf5-a01d-dedd886a4ad7"` اضافه شود
- در بخش گروه‌بندی تسک‌ها (خط 467-476)، تسک‌هایی که `source === "screenshot_feedback"` هستند و `assigned_to` برابر Sattar است، فیلتر شوند
- یعنی ستون Sattar هیچ فیدبک خودکاری نشان نمی‌دهد، فقط تسک‌های دستی

**3. `src/components/panels/InboxPanel.tsx`**
- به‌روزرسانی `FEEDBACK_RECIPIENTS` برای هماهنگی (فقط Radin)

### جزئیات فنی

| فایل | تغییر |
|------|-------|
| `AnnotationOverlay.tsx` خط 16 | `FEEDBACK_RECIPIENTS = [RADIN_PROFILE_ID]` (حذف Zahra) |
| `InboxPanel.tsx` خط 271 | `FEEDBACK_RECIPIENTS = [RADIN_PROFILE_ID]` (حذف Zahra) |
| `Tasks.tsx` خط 79-84 | اضافه `SATTAR_PROFILE_ID` |
| `Tasks.tsx` خط 467-476 | فیلتر: اگر تسک `source === "screenshot_feedback"` باشد و `assigned_to === SATTAR_PROFILE_ID` باشد، نمایش داده نشود |

### نتیجه
- فیدبک‌های جدید فقط به Radin ارسال می‌شوند
- ستون Sattar هیچ فیدبک خودکاری نمایش نمی‌دهد
- تسک‌های دستی که برای Sattar ایجاد شوند همچنان نمایش داده می‌شوند
