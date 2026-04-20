

# اصلاح خطاهای Backend هنگام Cut

## یافته‌ها

تمام درخواست‌های `manage-machine` با **200 OK** و سریع برمی‌گردند. اما در DB logs چهار خطای جدی که هنگام cut تکرار می‌شوند کشف شد:

| # | خطا | منبع | تأثیر |
|---|-----|------|-------|
| 1 | `unrecognized configuration parameter "supabase.service_role_key"` | یک trigger/function هر ۶۰ ثانیه (احتمالاً cron) | spam log + ممکن است یک trigger روی `machine_runs` fail کند |
| 2 | `record "new" has no field "channel"` | trigger روی notifications/messages | exception هنگام insert |
| 3 | `new row for relation "notifications" violates check constraint "notifications_priority_check"` | کد notification با priority نامعتبر | notification fail می‌شود |
| 4 | `column integration_connections.provider does not exist` | یک query/function | fail سکوتی |

علاوه بر این:
5. `duplicate key value violates unique constraint "activity_events_dedupe_key_unique"` — این خطر نیست (dedupe درست کار می‌کند) ولی نویز log است.

## رفع

### A) Trigger با فیلد `channel` غیرموجود (#۲)
شناسایی trigger و حذف/تصحیح ارجاع به `NEW.channel` که در جدول هدف وجود ندارد. به‌احتمال زیاد در یک trigger مرتبط با `notifications` یا `chat_messages` است.

### B) `notifications_priority_check` (#۳)
بررسی check constraint و یافتن کدی که مقدار خارج از enum (`low|normal|high|urgent`) می‌فرستد. تصحیح call site برای استفاده از مقدار معتبر.

### C) `supabase.service_role_key` (#۱)
یک DB function یا trigger در حال خواندن `current_setting('supabase.service_role_key')` است که در Postgres تعریف نشده. باید یا با `current_setting(..., true)` (silent) خوانده شود، یا کلاً حذف شود اگر استفاده نمی‌شود. هر ۶۰ ثانیه تکرار می‌شود → احتمالاً یک cron job.

### D) `integration_connections.provider` (#۴)
یا ستون `provider` به جدول اضافه شود، یا query اصلاح شود به نام درست ستون (احتمالاً `provider_name` یا `service`).

## برنامه

1. اجرای query روی `pg_trigger` و `pg_proc` برای پیدا کردن:
   - trigger‌های ارجاع‌دهنده به `NEW.channel`
   - functionهای استفاده‌کننده از `supabase.service_role_key`
2. بررسی schema جدول `notifications` برای دیدن `priority_check` و schema `integration_connections` برای ستون درست
3. صدور یک migration واحد:
   - DROP/REPLACE trigger خراب `channel`
   - REPLACE function استفاده‌کننده از `service_role_key` با `current_setting('...', true)` یا حذف اگر بی‌استفاده
   - تصحیح query که از `integration_connections.provider` استفاده می‌کند
4. اصلاح call site frontend/edge برای `notifications.priority` (در صورت لزوم)
5. تست end-to-end یک cut و بررسی DB logs برای نبود این خطاها

## محدوده

- فقط رفع باگ‌های backend
- بدون تغییر در UI، RLS، یا منطق Cut Engine
- بدون تغییر در `manage-machine` (که سالم است)

## اعتبارسنجی

- ✅ هیچ خطای `supabase.service_role_key` در DB logs پس از cut
- ✅ هیچ خطای `record "new" has no field "channel"` پس از cut
- ✅ هیچ خطای `notifications_priority_check`
- ✅ هیچ خطای `integration_connections.provider`
- ✅ Cut بدون "failed to fetch" کامل می‌شود

