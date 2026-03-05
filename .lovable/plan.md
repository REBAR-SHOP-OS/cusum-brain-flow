
هدف: مقدارهای `Invoice #` و `Invoice Date` باید از فرم AI Extract (همان دو فیلد مشخص‌شده در تصویر) وارد جریان تحویل شوند و در Packing Slip Preview همیشه نمایش داده شوند.

1) تشخیص ریشه‌ای مشکل
- الان منطق Loading/Preview عمدتاً از `orders(order_number, order_date)` مقدار می‌گیرد.
- اما طبق معماری فعلی، مقدار واقعی موردنظر شما در `extract_sessions(invoice_number, invoice_date)` ذخیره می‌شود (از فرم AI Extract).
- بنابراین حتی اگر مسیر سفارش پیدا شود، باز هم ممکن است دو فیلد خالی یا نامعتبر بمانند.
- علاوه بر این، Publish هنوز به‌خاطر migration شاخص یکتا (`idx_scheduled_activities_dedup`) fail می‌شود، پس هر اصلاح کدی بدون رفع migration به محیط منتشرشده نمی‌رسد.

2) طرح اصلاح دقیق (حداقلی و بدون اثر جانبی)
- فقط این 4 فایل تغییر می‌کنند:
  - `supabase/migrations/20260305000039_9c0eb1b8-7ff8-47b7-b3b3-1328dfb459c6.sql`
  - `supabase/migrations/20260305175234_dc1f87d4-e55c-402b-9052-7c9dc55aa113.sql`
  - `src/pages/LoadingStation.tsx`
  - `src/pages/DeliveryTerminal.tsx`

3) اصلاح migration (رفع blocker انتشار)
- در migration `20260305000039...`:
  - قبل از ساخت index، dedup مخصوص همان کلید و همان scope ایندکس انجام می‌شود (`entity_type='lead'`).
  - سپس `CREATE UNIQUE INDEX IF NOT EXISTS ... WHERE entity_type='lead'`.
- migration `20260305175234...` به no-op تبدیل می‌شود تا تداخل ترتیب اجرا حذف شود.
- نتیجه: Publish از خطای `23505` آزاد می‌شود.

4) اصلاح منطق داده Invoice در Loading Station (زمان ساخت packing_slip)
- در `LoadingStation.tsx` مسیر رزولوشن invoice به‌صورت deterministic و مطابق خواسته شما:
  1. `cut_plan_items` → گرفتن `work_order_id`
  2. `work_orders` → گرفتن `barlist_id` (و `order_id` فقط برای fallback)
  3. `barlists` → گرفتن `extract_session_id`
  4. `extract_sessions` → خواندن `invoice_number`, `invoice_date` (منبع اصلی)
- fallback فقط برای رکوردهای legacy:
  - اگر از extract_session چیزی نبود، از `orders(order_number, order_date)` پر شود.
- در insert `packing_slips`:
  - `invoice_number` و `invoice_date` با همین اولویت ذخیره شوند.

5) اصلاح Preview برای رکوردهای قدیمی (Backfill واقعی)
- در `DeliveryTerminal.tsx`:
  - اگر `packing_slips.invoice_number` یا `invoice_date` خالی بود:
    - همان مسیر بالا (تا extract_sessions) اجرا شود.
    - مقدار در UI همان لحظه نشان داده شود.
    - سپس `packing_slips` update شود تا دائمی شود.
- اولویت نمایش:
  1. مقدار موجود روی slip
  2. مقدار resolve‌شده از extract_sessions
  3. fallback از orders
  4. در نبود کامل داده: `—`

6) جزئیات فنی کلیدی
- فرمت تاریخ: `YYYY-MM-DD` قبل از set/insert/update.
- هر مرحله query دارای error handling صریح (بدون silent fail) با log قابل دیباگ.
- هیچ تغییری روی فایل‌های auto-generated انجام نمی‌شود.
- Scope فقط روی مسیر Invoice و migration blocker است.

7) معیار پذیرش (Done)
- روی همان رکوردی که الان خالی است، با زدن Preview:
  - `Invoice #` و `Invoice Date` از اطلاعات AI Extract نمایش داده شوند.
- بعد از بستن و باز کردن مجدد Preview:
  - همچنان پر بمانند (به دلیل backfill روی `packing_slips`).
- Publish بدون خطای unique index انجام شود.

8) تست نهایی که اجرا می‌شود
- تست End-to-End مسیر واقعی:
  - AI Extract (ورود invoice fields) → approve → loading → preview packing slip.
- تست رکورد قدیمی:
  - preview اول = پر شدن + backfill
  - preview دوم = خواندن مستقیم از `packing_slips` بدون خالی شدن.
