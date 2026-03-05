
هدف: رفع ریشه‌ای خطای Loading Station در Published بدون اثر جانبی.

Do I know what the issue is? بله.

مشکل دقیق (با شواهد):
1) خطا هنگام Publish روی Production هنوز روی migration `20260304234951` می‌شکند:
- `could not create unique index "idx_leads_odoo_id_unique"... (3083) is duplicated`
2) به همین دلیل migrationهای بعدی اجرا نمی‌شوند، از جمله migration اصلاح policy برای `delivery_stops`.
3) وضعیت فعلی Production:
- آخرین migration اعمال‌شده: `20260304215226`
- policy فعلی `delivery_stops` برای INSERT: فقط `admin, office, field` (نقش `workshop` ندارد)
- duplicate واقعی روی `leads.metadata->>'odoo_id'` وجود دارد (از جمله `3083`)

چرا تلاش قبلی جواب نداد:
- فایل `20260305155616...` به‌عنوان “safety-net before blocker” نوشته شده، اما timestamp آن بعد از migration بلاکر است؛ پس هرگز قبل از `20260304234951` اجرا نمی‌شود.

برنامه اجرای جراحی‌شده (Surgical):
1) اصلاح migration بلاکر اصلی (اولین نقطه شکست)
- فایل: `supabase/migrations/20260304234951_f3b11fd1-92a6-4b57-a45e-2967837649e5.sql`
- تغییر: قبل از ساخت unique index، dedup قطعی اضافه شود (نگه‌داشتن جدیدترین رکورد هر `odoo_id` با `row_number()` بر اساس `created_at DESC, id DESC`)، سپس `CREATE UNIQUE INDEX`.
- نتیجه: زنجیره migration از همان نقطه باز می‌شود.

2) خنثی‌سازی migrationهای تکراری index-fix برای کاهش ریسک
- فایل‌ها:
  - `20260305031029...`
  - `20260305144441...`
  - `20260305150909...`
  - `20260305154553...`
  - `20260305155616...`
- تغییر: تبدیل به no-op (`SELECT 1;`)
- دلیل: جلوگیری از drop/create تکراری index، کاهش lock و failure مجدد.

3) تمیز کردن migration policy تا فقط authorization fix انجام دهد
- فایل: `20260305154125_3e4c2883-7ac9-480f-9ed1-f20ca694dcc2.sql`
- تغییر: بخش dedup/index حذف شود و فقط policy `delivery_stops` باقی بماند:
  - drop policy قدیمی
  - create policy جدید INSERT با نقش‌های `admin, office, field, workshop`
- دلیل: تفکیک دقیق مسئولیت migration و جلوگیری از side-effect.

4) جلوگیری از تغییر فایل‌های auto-generated
- هرگونه تغییر روی `src/integrations/supabase/types.ts` حذف/بازگردانی شود.
- هیچ تغییری در `src/integrations/supabase/client.ts` انجام نشود.

5) راستی‌آزمایی بعد از Publish (Production)
- چک 1: migration head از `20260304215226` جلوتر رفته باشد.
- چک 2: policy INSERT جدول `delivery_stops` شامل `workshop` باشد.
- چک 3: query duplicate روی `odoo_id` خروجی خالی بدهد.
- چک 4 (E2E): در Published → Loading Station → `CREATE DELIVERY` بدون خطای RLS.
- چک 5 (E2E تکمیلی): Kiosk first-time register/punch بدون خطای RLS روی `profiles`.

جزئیات فنی (مختصر):
- ریشه خطای Loading Station خود کد صفحه نیست؛ Insert درست `company_id` را می‌فرستد.
- علت واقعی: policy صحیح هنوز به Live نرسیده چون migration chain قبل‌تر fail می‌شود.
- راه‌حل ریشه‌ای: unblock از اولین migration شکست‌خورده، نه افزودن migration دیرتر.
