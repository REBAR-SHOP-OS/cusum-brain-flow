
هدف: رفع ریشه‌ای خطای `new row violates row-level security policy for table delivery_stops` در Production و پایدارسازی زنجیره migration برای Publish‌های بعدی.

وضعیت واقعی که الان از Production تأیید شد:
- هنوز `181` کلید تکراری `metadata->>'odoo_id'` در `public.leads` وجود دارد.
- ایندکس `idx_leads_odoo_id_unique` در Production وجود ندارد (به‌خاطر fail شدن migration).
- policyهای فعال `delivery_stops` هنوز قدیمی‌اند:
  - `Office staff insert delivery_stops` (بدون `workshop`)
  - `Office staff update delivery_stops` (بدون `workshop`)
- در کد Loading Station، هنگام `CREATE DELIVERY` درج در `delivery_stops` با `company_id` انجام می‌شود؛ پس ریشه خطا policy است، نه payload.

برنامه اجرا (Root Fix):

1) Hotfix مستقیم روی Production (SQL اتمیک)
- در یک `BEGIN/COMMIT`:
  - dedup روی `leads` (نگه‌داشتن جدیدترین رکورد بر اساس `created_at DESC, id DESC`)
  - `DROP INDEX IF EXISTS` و سپس ساخت مجدد `idx_leads_odoo_id_unique`
  - حذف policyهای قدیمی insert/update روی `delivery_stops`
  - ساخت policyهای جدید `Staff insert delivery_stops` و `Staff update delivery_stops` با نقش‌های:
    `['admin','office','field','workshop']`
  - شرط tenant:
    `company_id = get_user_company_id(auth.uid())`

2) تمیزکاری migration chain در ریپو (برای جلوگیری از fail بعدی)
- بازنویسی migration بلاکر:
  - `20260304234951_...sql` → شامل dedup + `DROP INDEX IF EXISTS` + `CREATE UNIQUE INDEX`
- خنثی‌سازی migrationهای تکراری ایندکس به `SELECT 1;`
  - `20260305031029_...sql`
  - `20260305144441_...sql`
  - `20260305150909_...sql`
  - `20260305154553_...sql`
  - `20260305155616_...sql`
- یک migration نهایی idempotent برای policy نگه می‌داریم که هر دو policy insert/update را با role `workshop` تثبیت کند (به‌جای پخش شدن منطق بین چند فایل).

3) همگام‌سازی policy migrationها
- `20260305164953_...sql` از حالت فقط UPDATE خارج می‌شود و هر دو INSERT/UPDATE را پوشش می‌دهد (idempotent با `DROP POLICY IF EXISTS`).

4) راستی‌آزمایی فنی پس از اجرا
- DB checks:
  - duplicates برای `odoo_id` باید `0` شود.
  - policyهای `Staff insert/update delivery_stops` باید فعال باشند و شامل `workshop` باشند.
  - وجود `idx_leads_odoo_id_unique` روی `leads`.
- Functional checks (Published):
  - ورود با کاربر نقش `workshop`
  - مسیر `/shopfloor/loading`
  - تکمیل checklist
  - `CREATE DELIVERY` بدون خطای RLS
  - ایجاد موفق `deliveries` + `delivery_stops` + `packing_slips`

جزئیات فنی (خلاصه SQL هدف)
- policy INSERT:
  `WITH CHECK (company_id = get_user_company_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::app_role[]))`
- policy UPDATE:
  `USING (company_id = get_user_company_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::app_role[]))`
- dedup:
  window function با `ROW_NUMBER() OVER (PARTITION BY metadata->>'odoo_id' ORDER BY created_at DESC, id DESC)` و حذف `rn > 1`.

خروجی مورد انتظار:
- خطای RLS برای `delivery_stops` به‌صورت ریشه‌ای رفع می‌شود.
- migration بلاکر ایندکس دیگر Publish را متوقف نمی‌کند.
- زنجیره migration تمیز و پایدار می‌شود و deployهای بعدی fail نخواهند شد.
