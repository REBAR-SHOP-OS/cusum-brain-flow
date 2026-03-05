

# وضعیت فعلی

**Test**: اصلاح شده — policyهای جدید `Staff insert/update delivery_stops` (با role `workshop`) فعال‌اند.

**Production (Live)**: هنوز خراب است:
- ۱۸۱ کلید تکراری `odoo_id` → migration `20260304234951` fail می‌کند
- ایندکس `idx_leads_odoo_id_unique` وجود ندارد
- policyهای قدیمی (`Office staff insert/update`) بدون role `workshop` فعال‌اند
- تمام migrationهای بعدی (از جمله fix policy) بلاک شده‌اند

# مشکل اصلی

ابزار migration فقط روی Test اعمال می‌شود. برای Live، migration‌ها فقط هنگام **Publish** اجرا می‌شوند — اما همان migration بلاکر (`20260304234951`) باعث شکست Publish می‌شود. یک حلقه بن‌بست وجود دارد.

# راه‌حل: اقدام دستی شما روی Production

شما باید این SQL را در **Backend View → Run SQL → محیط Live** اجرا کنید:

```sql
-- 1) پاک‌سازی رکوردهای تکراری leads
DELETE FROM public.leads WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY metadata->>'odoo_id'
      ORDER BY created_at DESC, id DESC
    ) AS rn FROM public.leads
    WHERE metadata->>'odoo_id' IS NOT NULL
  ) t WHERE rn > 1
);

-- 2) ساخت ایندکس (برای رفع بلاک migration)
DROP INDEX IF EXISTS public.idx_leads_odoo_id_unique;
CREATE UNIQUE INDEX idx_leads_odoo_id_unique
  ON public.leads ((metadata->>'odoo_id'))
  WHERE metadata->>'odoo_id' IS NOT NULL;

-- 3) اصلاح policy INSERT (اضافه کردن workshop)
DROP POLICY IF EXISTS "Office staff insert delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Staff insert delivery_stops" ON public.delivery_stops;
CREATE POLICY "Staff insert delivery_stops" ON public.delivery_stops
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::public.app_role[])
);

-- 4) اصلاح policy UPDATE (اضافه کردن workshop)
DROP POLICY IF EXISTS "Office staff update delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Staff update delivery_stops" ON public.delivery_stops;
CREATE POLICY "Staff update delivery_stops" ON public.delivery_stops
FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::public.app_role[])
);
```

<lov-actions>
<lov-open-backend>Open Backend (Run SQL on Live)</lov-open-backend>
</lov-actions>

### بعد از اجرای SQL:
1. **Publish** کنید تا migration history همگام شود
2. با کاربر `workshop` وارد شوید و `CREATE DELIVERY` را در Loading Station تست کنید

من نمی‌توانم مستقیماً روی Production بنویسم — این اقدام باید توسط شما انجام شود.

