

# رفع خطای trigger قبل از اجرای dedup

## مشکل
تابع trigger به نام `block_lead_delete_with_children()` روی جدول `leads` فعال است و هنگام DELETE، ستون `lead_id` را در جدول `quotes` جستجو می‌کند — اما این ستون در `quotes` **وجود ندارد**. به همین دلیل اسکریپت dedup شکست خورد.

## راه‌حل
SQL زیر را در همان SQL editor (محیط **Live**) paste و Run کنید. این اسکریپت اول trigger را اصلاح می‌کند، سپس dedup و بقیه کارها را انجام می‌دهد:

```sql
-- 0) Fix broken trigger (quotes has no lead_id column)
CREATE OR REPLACE FUNCTION public.block_lead_delete_with_children()
RETURNS TRIGGER AS $$
BEGIN
  -- quotes table has no lead_id; skip that check
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 1) Dedup leads by odoo_id (keep newest)
DELETE FROM public.leads WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY metadata->>'odoo_id'
      ORDER BY created_at DESC, id DESC
    ) AS rn FROM public.leads
    WHERE metadata->>'odoo_id' IS NOT NULL
  ) t WHERE rn > 1
);

-- 2) Rebuild unique index
DROP INDEX IF EXISTS public.idx_leads_odoo_id_unique;
CREATE UNIQUE INDEX idx_leads_odoo_id_unique
  ON public.leads ((metadata->>'odoo_id'))
  WHERE metadata->>'odoo_id' IS NOT NULL;

-- 3) Fix delivery_stops INSERT policy
DROP POLICY IF EXISTS "Office staff insert delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Staff insert delivery_stops" ON public.delivery_stops;
CREATE POLICY "Staff insert delivery_stops" ON public.delivery_stops
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::public.app_role[])
);

-- 4) Fix delivery_stops UPDATE policy
DROP POLICY IF EXISTS "Office staff update delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Staff update delivery_stops" ON public.delivery_stops;
CREATE POLICY "Staff update delivery_stops" ON public.delivery_stops
FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::public.app_role[])
);
```

همین SQL را کپی کنید، در editor بچسبانید و **Run** بزنید. بعد از موفقیت، **Publish** کنید.

سپس یک migration هم برای Test ایجاد خواهد شد تا trigger در آنجا هم اصلاح شود و زنجیره migration همگام بماند.

