

## سیستم تایید/رد تسک‌های انجام‌شده توسط Neel

### خلاصه
وقتی Radin تسکی را Done می‌کند، کنار آن تسک خط‌خورده دو آیکون ✅ (تایید) و ❌ (رد) نمایش داده شود که فقط Neel بتواند روی آنها کلیک کند.

### تغییرات دیتابیس
- افزودن دو ستون به جدول `tasks`:
  - `review_status` (text, nullable) — مقادیر: `approved`, `rejected`, `null` (بررسی نشده)
  - `reviewed_by` (uuid, nullable) — پروفایل کسی که تایید/رد کرده

### تغییرات UI در `src/pages/Tasks.tsx`

**بخش completedTasks (خطوط 1067-1101):**
- بعد از نام تسک و قبل از دکمه حذف، دو آیکون اضافه شود:
  - آیکون `Check` (سبز) برای تایید
  - آیکون `X` (قرمز) برای رد
- این آیکون‌ها **فقط** وقتی نمایش داده شوند که:
  1. تسک `assigned_to === RADIN_PROFILE_ID` باشد (تسک‌های Radin)
  2. کاربر فعلی `currentProfileId === NEEL_PROFILE_ID` باشد
  3. تسک هنوز `review_status` نداشته باشد (null)
- اگر تسک قبلاً تایید/رد شده، یک Badge کوچک نمایش دهد (✅ Approved / ❌ Rejected)

**تابع جدید `reviewTask`:**
- آپدیت `review_status` و `reviewed_by` در دیتابیس
- ثبت در audit log
- اگر رد شد، تسک را به status `open` برگرداند (بازگشت به لیست فعال)

### فایل‌ها
- **Migration SQL** — افزودن `review_status` و `reviewed_by` به `tasks`
- **`src/pages/Tasks.tsx`** — افزودن آیکون‌های تایید/رد و تابع `reviewTask`

