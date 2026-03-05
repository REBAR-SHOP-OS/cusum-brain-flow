
## خلاصه ریشه مشکل (غیرفنی)
مشکل شما به‌درستی هنوز کامل حل نشده چون دو ایراد همزمان وجود دارد:

1) **Publish گیر کرده** و migration مربوط به unique index جلوتر از پاک‌سازی داده‌های تکراری اجرا می‌شود؛ بنابراین تغییرات کامل به محیط Live نمی‌رسد.  
2) در کد **Preview Packing Slip**، پر کردن Invoice# و Invoice Date با یک کوئری تو‌در‌تو انجام شده که در برخی رکوردها قابل اتکا نیست؛ در نتیجه مقدار `—` می‌ماند.

من یک «پرامپت سخت و دقیق» می‌دهم که AI را مجبور می‌کند راه‌حل را ریشه‌ای و نهایی اجرا کند.

---

## پرامپت بسیار سخت (آماده کپی)
```text
تو باید این باگ را ریشه‌ای و قطعی حل کنی. هیچ پاسخ کلی نمی‌خواهم. فقط با تغییرات واقعی و قابل انتشار.

هدف:
در Packing Slip Preview، فیلدهای Invoice # و Invoice Date هرگز خالی نمانند وقتی داده Order وجود دارد.

قوانین اجباری:
- هیچ تغییری خارج از این Scope نده.
- فایل‌های auto-generated را هرگز ادیت نکن:
  - src/integrations/supabase/client.ts
  - src/integrations/supabase/types.ts
  - supabase/config.toml
  - .env
- بعد از تغییرات، دقیق بگو چه فایل‌هایی تغییر کردند و چرا.
- اگر جایی خطا می‌گیری، silent fail ممنوع؛ handling اجباری.

کارهای اجباری مرحله‌به‌مرحله:

1) Publish blocker را قطعی رفع کن
- فایل migration زیر را اصلاح کن:
  supabase/migrations/20260305000039_9c0eb1b8-7ff8-47b7-b3b3-1328dfb459c6.sql
- قبل از CREATE UNIQUE INDEX، dedup را همان‌جا انجام بده (برای همان کلید index و entity_type='lead').
- ساخت index را idempotent کن (IF NOT EXISTS).
- migration بعدی dedup (20260305175234...) را no-op کن تا ترتیب اجرای اشتباه دوباره اثر نگذارد.

2) منطق Invoice را در UI قطعی و deterministic کن
- در DeliveryTerminal.tsx و LoadingStation.tsx
- کوئری تو‌در‌تو:
  cut_plan_items -> work_orders(orders(...))
  را حذف کن.
- به‌جای آن مسیر 3 مرحله‌ای قطعی بزن:
  a) از cut_plan_items یک work_order_id معتبر بگیر
  b) از work_orders مقدار order_id بگیر
  c) از orders مقدار order_number و order_date بگیر
- اگر مرحله‌ای error/null داشت، fallback واضح و قابل دیباگ بگذار.

3) Backfill در زمان Preview
- در DeliveryTerminal وقتی slip.invoice_number یا slip.invoice_date خالی است:
  - از مسیر 3 مرحله‌ای بالا resolve کن
  - در همان لحظه UI را با مقدار resolved نمایش بده
  - سپس packing_slips را update کن تا برای دفعات بعد هم پر باشد.

4) کیفیت و ایمنی
- تمام queryها error check داشته باشند (error را نادیده نگذر).
- فرمت invoiceDate = YYYY-MM-DD
- اولویت مقدار:
  - اگر slip مقدار دارد همان
  - اگر ندارد مقدار resolve شده از order
  - اگر order هم نبود، آنگاه "—"

5) معیار پذیرش (Definition of Done)
- روی رکوردی که الان خالی است، با زدن Preview باید Invoice # و Invoice Date نمایش داده شود.
- بعد از بستن و باز کردن مجدد Preview، همچنان پر بماند (به دلیل update packing_slips).
- Publish بدون خطای unique index انجام شود.
- هیچ فایل auto-generated ادیت نشده باشد.

6) خروجی نهایی که باید به من بدهی
- لیست فایل‌های تغییر یافته
- خلاصه دقیق منطق جدید
- SQL نهایی migration اصلاح‌شده
- نتیجه تست دستی: «قبل/بعد» برای همان رکورد مشکل‌دار
```

---

## جزئیات فنی (برای اجرای درست)
- رکوردی که شما نشان دادید واقعاً `packing_slips.invoice_*` خالی دارد، اما در دیتابیس Order مربوطه موجود است؛ پس مشکل از **resolve/query logic** است نه نبود داده.
- دلیل گیر Publish: index `idx_scheduled_activities_dedup` قبل از حذف duplicate ساخته می‌شود و با `23505` می‌خورد.
- پیشنهاد فنی دقیق:
  - dedup را داخل همان migration ساخت index قرار بده (قبل از CREATE INDEX)
  - queryهای nested را به queryهای مرحله‌ای ساده تبدیل کن تا ambiguity/shape mismatch/RLS-side effects کم شود
  - هنگام Preview برای slipهای قدیمی یک backfill update انجام بده تا باگ برای همیشه پاک شود.

---

## فایل‌هایی که باید در اجرای نهایی تغییر کنند
1) `supabase/migrations/20260305000039_9c0eb1b8-7ff8-47b7-b3b3-1328dfb459c6.sql`  
2) `supabase/migrations/20260305175234_dc1f87d4-e55c-402b-9052-7c9dc55aa113.sql` (no-op)  
3) `src/pages/DeliveryTerminal.tsx`  
4) `src/pages/LoadingStation.tsx`
