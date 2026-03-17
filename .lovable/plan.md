

## بررسی وضعیت فعلی

دکمه **"Confirm & Save"** در پایین `PurchasingListPanel.tsx` (خط ۲۳۶-۲۵۲) در حال حاضر وجود دارد و `confirmList(dateStr)` را فراخوانی می‌کند. این تابع `due_date` را روی آیتم‌هایی که `due_date` ندارند ست می‌کند.

### مشکل فعلی
- دکمه بدون تأیید کاربر مستقیم اجرا می‌شود
- اگر تاریخ انتخاب نشده، از تاریخ امروز استفاده می‌کند بدون اطلاع کاربر
- پس از تأیید، سایدبار RECENTS به‌روز می‌شود (از طریق realtime) ولی هیچ بازخورد بصری واضحی نیست

### تغییرات پیشنهادی

**1. اضافه کردن دیالوگ تأیید قبل از ذخیره نهایی**

فایل: `src/components/purchasing/PurchasingListPanel.tsx`

- اضافه کردن state برای نمایش `ConfirmActionDialog` (که قبلاً در پروژه موجود است)
- وقتی کاربر دکمه "Confirm & Save" را می‌زند:
  - اگر تاریخ انتخاب نشده → ابتدا calendar popover باز شود تا تاریخ انتخاب کند
  - اگر تاریخ انتخاب شده → دیالوگ تأیید نمایش داده شود با جزئیات: تعداد آیتم‌ها و تاریخ انتخابی
- پس از تأیید در دیالوگ → `confirmList` اجرا شود و لیست در RECENTS ذخیره شود

**تغییرات کد:**
- Import `ConfirmActionDialog` از `@/components/accounting/ConfirmActionDialog`
- اضافه کردن `confirmDialogOpen` state
- تغییر onClick دکمه: اگر تاریخ نیست → toast خطا، اگر هست → باز کردن دیالوگ
- دیالوگ شامل تعداد آیتم‌های pending و تاریخ انتخابی
- پس از confirm → اجرای `confirmList` + `refetch` + بستن دیالوگ

### فایل‌ها
- `src/components/purchasing/PurchasingListPanel.tsx` — اضافه کردن دیالوگ تأیید نهایی

