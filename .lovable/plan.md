
# بررسی: آیا واقعاً به `info@deltoidconsulting.com` ایمیل ارسال شده؟

## یافته‌های اولیه از DB
در بررسی قبلی، جدول‌های `email_campaign_sends` و `lead_communications` خالی بودند. اما سیستم چندین مسیر ارسال ایمیل دارد که هنوز چک نشده‌اند. باید قبل از پاسخ نهایی، **همهٔ منابع ارسال** را روی این آدرس خاص جستجو کنم.

## مسیرهای ارسال احتمالی که باید بررسی شوند

1. **`email_send_log`** — جدول مرجع همهٔ ارسال‌های Lovable Email infrastructure (transactional + auth).
2. **`prospects`** — اگر این آدرس در seed/lead data باشد و وضعیت `emailed` داشته باشد.
3. **`contacts`** — آیا اصلاً این آدرس در دیتابیس مشتری‌ها هست؟
4. **`leads` / `lead_communications`** — لاگ ارتباطات لیدها.
5. **Edge function logs** — لاگ‌های `gmail-send`, `email-campaign-send`, `send-quote-email`, `send-transactional-email` با فیلتر روی این ایمیل.
6. **`alert_dispatch_log`** و سایر جدول‌های نوتیفیکیشن — اگر آدرس به‌عنوان مقصد ثبت شده باشد.

## برنامهٔ اقدام (Read-Only Investigation)

### مرحلهٔ ۱ — جستجوی DB
کوئری‌های هدفمند روی هر جدول:
```sql
SELECT 'email_send_log' src, * FROM email_send_log WHERE recipient_email ILIKE '%deltoid%';
SELECT 'prospects' src, * FROM prospects WHERE email ILIKE '%deltoid%';
SELECT 'contacts' src, * FROM contacts WHERE email ILIKE '%deltoid%';
SELECT 'leads' src, * FROM leads WHERE customer_email ILIKE '%deltoid%' OR notes ILIKE '%deltoid%';
SELECT 'lead_communications' src, * FROM lead_communications WHERE recipient ILIKE '%deltoid%' OR body ILIKE '%deltoid%';
SELECT 'email_campaign_sends' src, * FROM email_campaign_sends WHERE email ILIKE '%deltoid%';
SELECT 'alert_dispatch_log' src, * FROM alert_dispatch_log WHERE recipient ILIKE '%deltoid%' OR payload::text ILIKE '%deltoid%';
```

### مرحلهٔ ۲ — جستجوی edge function logs
بررسی لاگ‌های ۴ تابع کلیدی با فیلتر `deltoid`:
- `gmail-send`
- `email-campaign-send`
- `send-quote-email`
- `send-transactional-email`

### مرحلهٔ ۳ — گزارش به کاربر
ارائهٔ تصویر کامل:
- **اگر یافته شد**: تاریخ دقیق، منبع (کدام تابع/دکمه)، فرستنده (کاربر یا cron)، محتوا/subject، وضعیت تحویل.
- **اگر یافته نشد**: تأیید قطعی که از این سیستم به آن آدرس ایمیلی نرفته — احتمالاً ایمیل از سیستم دیگری (Gmail شخصی، QuickBooks، RingCentral) ارسال شده یا کاربر اشتباه می‌کند.

## چه چیزی تغییر نمی‌کند
- هیچ داده‌ای حذف یا اصلاح نمی‌شود.
- این فقط یک **تحقیق فقط-خواندنی** است.
- اگر بعد از بررسی نیاز به اقدام (مثلاً suppress کردن آدرس یا پاک‌سازی) باشد، plan جداگانه ارائه می‌دهم.

## خروجی نهایی
گزارش شفاف به فارسی شامل:
1. آیا ارسال انجام شده؟ (بله/خیر)
2. اگر بله: کِی، توسط چه کسی، با کدام template/دکمه، با چه محتوایی.
3. اگر خیر: منابع جایگزین احتمالی برای بررسی خارج از ERP.
