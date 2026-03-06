

# افزودن دکمه حذف کاربر در Kiosk Status برای ادمین

## تغییرات

### فایل: `src/pages/TimeClock.tsx`

در بخش Kiosk Status (خطوط ۵۰۷-۵۳۱)، یک دکمه `Trash2` (آیکون سطل زباله) به هر کارت کاربر اضافه شود که:
- فقط برای ادمین (`isAdmin`) نمایش داده شود
- قبل از حذف، یک `confirm()` dialog نشان دهد
- پروفایل را از جدول `profiles` حذف کند (با استفاده از `deleteProfile` از `useProfiles` hook)
- پس از حذف، لیست را refresh کند

### جزئیات پیاده‌سازی:
1. ایمپورت آیکون `Trash2` از lucide-react (در خط ۱۵)
2. استفاده از `deleteProfile` mutation از `useProfiles` hook (یا مستقیم از supabase)
3. اضافه کردن دکمه قرمز کوچک کنار Badge در هر کارت کیوسک
4. تایید حذف با dialog ساده قبل از اجرا

