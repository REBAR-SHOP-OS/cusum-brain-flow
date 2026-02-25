

## تغییر مسیر فیدبک‌ها: فقط Radin + Zahra (حذف Sattar)

### خلاصه
تمام فیدبک‌های اسکرین‌شات باید فقط به **Radin** و **Zahra** ارسال شوند. Sattar هرگز نباید فیدبکی دریافت کند.

### تغییرات

**1. `src/components/feedback/AnnotationOverlay.tsx`**
- اضافه کردن `ZAHRA_PROFILE_ID = "2356f04b-0e8d-4b50-bd62-1aa0420f74ab"`
- تغییر آرایه گیرندگان از `[RADIN_PROFILE_ID]` به `[RADIN_PROFILE_ID, ZAHRA_PROFILE_ID]` در هر دو حلقه (ایجاد تسک و ارسال نوتیفیکیشن)

**2. `src/pages/Tasks.tsx`**
- اضافه کردن `ZAHRA_PROFILE_ID`
- در تابع `reReportFeedback`: تغییر `assignTo` از fallback به Radin/Sattar → فقط Radin
- ایجاد تسک re-report برای هر دو نفر (Radin + Zahra) به جای یک نفر

**3. `src/components/panels/InboxPanel.tsx`**
- اضافه کردن `ZAHRA_PROFILE_ID`
- در `handleReReport`: ایجاد تسک re-report برای هر دو Radin و Zahra

### جزئیات فنی

| فایل | تغییر |
|------|-------|
| AnnotationOverlay.tsx (خط 14, 244, 262) | اضافه ZAHRA_PROFILE_ID، تغییر آرایه‌ها به `[RADIN_PROFILE_ID, ZAHRA_PROFILE_ID]` |
| Tasks.tsx (خط 81, 612-613) | اضافه ZAHRA_PROFILE_ID، تغییر re-report به ایجاد تسک برای هر دو نفر، حذف هر ارجاع Sattar از مسیر فیدبک |
| InboxPanel.tsx (خط 269, 296) | اضافه ZAHRA_PROFILE_ID، re-report برای هر دو نفر |

### نتیجه
- فیدبک‌ها همیشه فقط برای Radin و Zahra ایجاد می‌شود
- Sattar هیچ فیدبکی دریافت نمی‌کند
- Re-report نیز فقط به Radin و Zahra ارسال می‌شود
- هیچ تغییری در سایر بخش‌های اپلیکیشن ایجاد نمی‌شود

