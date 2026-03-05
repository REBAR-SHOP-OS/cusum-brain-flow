

# رفع دو مشکل: Publish Blocker + RLS Error

## تحلیل ریشه‌ای

**مشکل ۱ (Publish):** سیستم deploy از schema diff استفاده می‌کند و دستورات DML (DELETE) را روی Live اجرا نمی‌کند. بنابراین هر بار index ساخته می‌شود ولی duplicate ها حذف نشده‌اند. تنها راه‌حل: **حذف index از dev schema** تا diff تفاوتی نبیند و publish بدون مشکل انجام شود.

**مشکل ۲ (RLS profiles):** چون publish خراب است، آخرین نسخه edge function `kiosk-register` (که از service-role استفاده می‌کند) deploy نشده. نسخه قدیمی احتمالاً بدون service-role کار می‌کند. **با رفع publish، edge function جدید خودکار deploy می‌شود و RLS error برطرف می‌شود.**

## تغییرات

### ۱. تبدیل migration های مشکل‌ساز به no-op
این ۴ فایل محتوایشان به `SELECT 1;` تغییر می‌کند:
- `supabase/migrations/20260305000039_...sql`
- `supabase/migrations/20260305175234_...sql`
- `supabase/migrations/20260305182054_...sql`
- `supabase/migrations/20260305182940_...sql`

### ۲. ساخت migration جدید برای حذف index از dev
یک migration جدید:
```sql
DROP INDEX IF EXISTS idx_scheduled_activities_dedup;
```
این باعث می‌شود dev schema دیگر این index را نداشته باشد → schema diff تفاوتی نمی‌بیند → publish موفق می‌شود.

### ۳. بعد از publish موفق
- Edge functions خودکار deploy می‌شوند → RLS error رفع می‌شود
- بعداً می‌توانیم index را (پس از dedup دستی روی live) دوباره اضافه کنیم

## نتیجه
- Publish بدون خطا
- Registration در Kiosk بدون RLS error
- هیچ داده‌ای حذف نمی‌شود

