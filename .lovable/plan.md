
هدف: رفع ریشه‌ای ارورهای Production بدون آسیب جانبی  
1) `new row violates row-level security policy for table "profiles"` در Kiosk  
2) `new row violates row-level security policy for table "delivery_stops"` بعد از Create Delivery

وضعیت واقعی که بررسی شد:
- Production روی migration `20260304215226` گیر کرده.
- migration بعدی (`20260304234951`) هنگام ساخت ایندکس یونیک `idx_leads_odoo_id_unique` به‌خاطر duplicate های `odoo_id` fail می‌شود.
- تا وقتی این fail رفع نشود، migration های بعدی (از جمله policy fix مربوط به `delivery_stops` و deploy نسخه‌های جدید) به Live نمی‌رسند.
- روی Production هنوز policy `delivery_stops` برای INSERT نقش `workshop` را ندارد.
- Duplicate های `leads.metadata->>'odoo_id'` در Production واقعاً وجود دارند.

طرح اجرای امن و جراحی‌شده (حداقل تغییر، بدون دستکاری بخش‌های نامرتبط):

مرحله 1) رفع migration بلاکر اصلی (فایل قدیمی، نه migration جدید)
- فایل: `supabase/migrations/20260304234951_f3b11fd1-92a6-4b57-a45e-2967837649e5.sql`
- تغییر:
  - قبل از `CREATE UNIQUE INDEX` یک dedup قطعی اضافه می‌شود (با `row_number()` روی `odoo_id` و نگه‌داشتن جدیدترین رکورد).
  - سپس index ساخته می‌شود.
- دلیل: چون این migration زودتر از همه اجرا می‌شود، تنها نقطه درست برای unblocking است.

مرحله 2) بی‌اثر کردن migration های تکراریِ index-fix
- فایل‌ها:
  - `supabase/migrations/20260305031029_a8c55015-d526-4cb6-8242-a0a5ef2509d2.sql`
  - `supabase/migrations/20260305144441_4a7998d1-f7c7-4e06-95b8-6fe60288ccb0.sql`
  - `supabase/migrations/20260305150909_ea5ec3cd-5e6d-471e-9a54-ff8bc116ce82.sql`
  - `supabase/migrations/20260305155616_b02224a2-e10a-4e9a-90ac-1bdb2d0f5531.sql`
- تغییر: هر 4 فایل → `SELECT 1;`
- دلیل: جلوگیری از drop/create تکراری ایندکس، کاهش ریسک lock و شکست مجدد pipeline.

مرحله 3) تمیز کردن migration policy برای delivery_stops
- فایل: `supabase/migrations/20260305154125_3e4c2883-7ac9-480f-9ed1-f20ca694dcc2.sql`
- تغییر پیشنهادی:
  - بخش dedup/index از این فایل حذف شود.
  - فقط policy مربوط به `delivery_stops` باقی بماند:
    - drop policy قدیمی
    - create policy جدید با نقش‌های `admin, office, field, workshop`
- دلیل: این migration باید فقط authorization fix را انجام دهد، نه تغییرات سنگین روی leads.

مرحله 4) عدم دستکاری فایل‌های auto-generated
- `src/integrations/supabase/types.ts` نباید دستی تغییر کند.
- هر تغییری که قبلاً ناخواسته وارد شده، باید revert شود (تا mismatch تایپ/اسکیما ایجاد نشود).

مرحله 5) Publish و راستی‌آزمایی Production (E2E)
- بعد از اعمال اصلاحات و Publish، این چک‌ها انجام می‌شود:
  1. Migration chain در Live کامل اجرا شده باشد (نسخه‌ها جلوتر از `20260304215226` شوند).
  2. Policy جدول `delivery_stops` در Live شامل `workshop` برای INSERT باشد.
  3. سناریوی Published:
     - با کاربر workshop → Create Delivery موفق + درج `delivery_stops` بدون RLS error.
  4. سناریوی Published Kiosk:
     - First-time face scan → نمایش فرم نام
     - Register & Clock In → بدون خطای `profiles` و ایجاد پروفایل/clock-in موفق.

جزئیات فنی (خلاصه و دقیق):
- ریشه مشکل «profiles RLS» و «delivery_stops RLS» در Published، یکسان است: Publish به Live کامل نشده چون migration chain جلوتر fail می‌شود.
- راه‌حل ریشه‌ای، «باز کردن مسیر migration از اولین نقطه شکست» است، نه اضافه‌کردن migration دیرتر.
- هیچ policy باز و خطرناک جدیدی برای `profiles` اضافه نمی‌کنیم؛ امنیت فعلی حفظ می‌شود.
- اصلاح‌ها محدود به فایل‌های migration مرتبط هستند (طبق اصل Surgical Execution، بدون تغییر بخش‌های نامرتبط).

خروجی مورد انتظار بعد از اجرا:
- Publish دیگر روی unique index fail نمی‌کند.
- policy اصلاح‌شده `delivery_stops` واقعاً به Live می‌رسد.
- ثبت اولین نفر در Kiosk (ai@rebar.shop) بدون خطای RLS روی `profiles` انجام می‌شود.
