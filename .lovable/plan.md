
هدف: رفع قطعی خطای `delivery_stops` با اجرای مستقیم SQL روی Production + تمیزکاری زنجیره migration تا Publish بعدی بدون شکست انجام شود.

## وضعیت فعلی (بررسی انجام‌شده)
- در Production هنوز **181 کلید تکراری** برای `metadata->>'odoo_id'` در جدول `leads` وجود دارد؛ همین باعث خطای `CREATE UNIQUE INDEX idx_leads_odoo_id_unique` می‌شود.
- policyهای Production روی `delivery_stops` هنوز این‌ها هستند:
  - `Office staff insert delivery_stops` (بدون role `workshop`)
  - `Office staff update delivery_stops` (بدون role `workshop`)
- migration شکست‌خورده فعلی:
  - `20260304234951_f3b11fd1-92a6-4b57-a45e-2967837649e5.sql` فقط `CREATE UNIQUE INDEX` دارد و dedup داخلش نیست.

## برنامه اجرا

### 1) Hotfix مستقیم روی Production (Run SQL در Live)
یک اسکریپت اتمیک اجرا می‌شود تا هم duplicate پاک شود هم policyها اصلاح شوند:

```sql
BEGIN;

-- A) Dedup leads by odoo_id (keep newest)
DELETE FROM public.leads
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY metadata->>'odoo_id'
             ORDER BY created_at DESC, id DESC
           ) AS rn
    FROM public.leads
    WHERE metadata->>'odoo_id' IS NOT NULL
  ) t
  WHERE rn > 1
);

-- B) Rebuild unique index safely
DROP INDEX IF EXISTS public.idx_leads_odoo_id_unique;
CREATE UNIQUE INDEX idx_leads_odoo_id_unique
  ON public.leads ((metadata->>'odoo_id'))
  WHERE metadata->>'odoo_id' IS NOT NULL;

-- C) Fix delivery_stops INSERT policy (include workshop)
DROP POLICY IF EXISTS "Office staff insert delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Staff insert delivery_stops" ON public.delivery_stops;
CREATE POLICY "Staff insert delivery_stops"
ON public.delivery_stops
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::public.app_role[])
);

-- D) Fix delivery_stops UPDATE policy (include workshop)
DROP POLICY IF EXISTS "Office staff update delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Staff update delivery_stops" ON public.delivery_stops;
CREATE POLICY "Staff update delivery_stops"
ON public.delivery_stops
FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::public.app_role[])
);

COMMIT;
```

### 2) تمیزکاری migrationها در ریپو (برای Publish پایدار)
- فایل `20260304234951_...sql` بازنویسی می‌شود تا همیشه قبل از ساخت index، dedup انجام دهد + `DROP INDEX IF EXISTS`.
- migrationهای تکراری مربوط به همان index به no-op (`SELECT 1;`) تبدیل می‌شوند:
  - `20260305031029_...sql`
  - `20260305144441_...sql`
  - `20260305150909_...sql`
  - `20260305154553_...sql`
  - `20260305155616_...sql`
  - `20260305163106_...sql`
- برای policyها یک migration نهایی و تمیز نگه می‌داریم (idempotent) تا Test/Live همیشه همگام بمانند؛ منطق policy داخل no-opها گم نشود.

### 3) Publish و راستی‌آزمایی
- Publish مجدد.
- چک دیتابیس:
  - `duplicate_keys = 0` برای `odoo_id`
  - وجود policyهای `Staff insert/update delivery_stops` با role `workshop`
- چک عملکردی در Published:
  - ورود با نقش workshop
  - مسیر Loading Station
  - اجرای `CREATE DELIVERY` بدون RLS error
  - ثبت موفق `deliveries` + `delivery_stops` + `packing_slips`

## خروجی مورد انتظار
- خطای publish مربوط به `idx_leads_odoo_id_unique` به‌صورت ریشه‌ای حذف می‌شود.
- خطای RLS روی `delivery_stops` برای نقش `workshop` دیگر تکرار نمی‌شود.
- زنجیره migration تمیز و پایدار می‌شود و deployهای بعدی fail نمی‌شوند.
