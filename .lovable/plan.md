

# حذف سیستم Auto-Clockout

## خلاصه
حذف کامل منطق بستن خودکار شیفت‌ها. کارمندان فقط از طریق کیوسک یا دستی clock in/out می‌کنند.

## تغییرات

### 1. حذف ۲ کران‌جاب از دیتابیس
- Job #22: evening sweep (ساعت ۱۰ شب UTC — شنبه تا چهارشنبه)
- Job #41: end_of_day sweep (ساعت ۹ شب UTC — هر روز)

```sql
SELECT cron.unschedule(22);
SELECT cron.unschedule(41);
```

### 2. حذف Edge Function
- حذف فایل `supabase/functions/auto-clockout/index.ts`

### 3. پاکسازی `useTimeClock.ts`
- حذف تابع `closeStaleShifts` (خطوط ۲۴۷–۲۷۸)
- حذف محاسبه `staleCount` (خطوط ۲۸۰–۲۸۵)
- حذف خروجی‌های `closeStaleShifts` و `staleCount` از return
- **نگه داشتن**: منطق بستن شیفت قبلی هنگام clock-in جدید (خطوط ۱۴۵–۱۵۴) — این ضروری است تا اگر کارمند فراموش کرد clock-out کند و فردا clock-in زد، شیفت قدیمی بسته شود

### 4. پاکسازی `TimeClock.tsx`
- حذف `closeStaleShifts` و `staleCount` از destructure
- حذف `staleConfirmOpen` state
- حذف بلاک هشدار stale shifts (خطوط ۵۲۲–۵۳۶)
- حذف `ConfirmActionDialog` مربوط به stale shifts (خطوط ۷۳۲–۷۴۴)

### 5. غیرفعال‌سازی automation config
- آپدیت `automation_configs` → `enabled = false` برای `auto_clockout`

## آنچه حفظ می‌شود
- Clock in/out دستی کارمند ✅
- Kiosk punch (Face ID) ✅
- Admin clock-out دستی ✅
- بستن شیفت قبلی هنگام clock-in جدید ✅
- محدودیت ساعت ۶ صبح ✅

## فایل‌ها

| فایل | تغییر |
|------|--------|
| `supabase/functions/auto-clockout/index.ts` | حذف |
| `src/hooks/useTimeClock.ts` | حذف closeStaleShifts و staleCount |
| `src/pages/TimeClock.tsx` | حذف UI هشدار و دکمه stale shifts |
| دیتابیس (cron jobs) | حذف ۲ job |
| دیتابیس (automation_configs) | غیرفعال |

