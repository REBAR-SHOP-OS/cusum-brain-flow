

## توقف ساخت لید از ایمیل + نمایش فقط لیدهای Odoo در Pipeline

### مشکل
Pipeline الان ۷ لید در ستون "New" نشان می‌دهد ولی Odoo فقط ۵ تا دارد. ۲ لید اضافه از ایمیل‌های دریافتی (`process-rfq-emails`) ساخته شده‌اند با source مثل `Email: andrew@cadeploy.com`.

### راه‌حل — دو تغییر:

**1. `supabase/functions/process-rfq-emails/index.ts` — متوقف کردن ساخت لید از ایمیل**
- بخش "INSERT LEAD" (خط ~1217) را غیرفعال کنیم: به جای ساخت لید جدید، فقط یک activity/note به لید موجود اضافه شود یا ایمیل را skip کنیم
- ایمیل‌هایی که به لید موجود match می‌شوند (routing) همچنان کار می‌کنند — فقط ساخت لید **جدید** از ایمیل متوقف می‌شود

**2. `src/pages/Pipeline.tsx` — فیلتر نمایش فقط Odoo leads**
- در query اصلی (خط ~237)، فیلتر `.eq("source", "odoo_sync")` اضافه شود
- این تضمین می‌کند Pipeline **فقط** لیدهای sync شده از Odoo را نشان دهد و تعداد دقیقاً با Odoo مطابقت داشته باشد

**3. پاک‌سازی ۲ لید اضافه موجود**
- با migration، دو لید email-source در stage "new" را archive یا حذف کنیم

### فایل‌ها
- `supabase/functions/process-rfq-emails/index.ts` — حذف بلاک INSERT LEAD
- `src/pages/Pipeline.tsx` — فیلتر `.eq("source", "odoo_sync")`
- SQL migration برای پاک‌سازی لیدهای غیر-Odoo موجود

