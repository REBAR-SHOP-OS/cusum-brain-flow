

# Hotfix: رفع ریشه‌ای خطای `delivery_stops` RLS در Production

## مشکل
Production هنوز policy قدیمی را دارد:
- **INSERT on `delivery_stops`**: فقط `admin, office, field` — نقش **`workshop` وجود ندارد**
- Migration اصلاح‌کننده (`20260305154125`) هرگز اجرا نشده چون migration قبلی (`20260304234951`) به‌خاطر 181 `odoo_id` تکراری fail می‌کند

## راه‌حل: دو SQL مستقیم روی Production

### مرحله 1: Dedup leads (رفع بلاکر)
```sql
DELETE FROM leads WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY metadata->>'odoo_id'
      ORDER BY created_at DESC, id DESC
    ) AS rn FROM leads WHERE metadata->>'odoo_id' IS NOT NULL
  ) sub WHERE rn > 1
);
```

### مرحله 2: اصلاح policy (رفع خطای اصلی)
```sql
DROP POLICY IF EXISTS "Office staff insert delivery_stops" ON delivery_stops;
CREATE POLICY "Staff insert delivery_stops" ON delivery_stops
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::app_role[])
  );
```

### مرحله 3: همچنین UPDATE policy هم workshop ندارد — اضافه می‌کنیم
```sql
DROP POLICY IF EXISTS "Office staff update delivery_stops" ON delivery_stops;
CREATE POLICY "Staff update delivery_stops" ON delivery_stops
  FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::app_role[])
  );
```

### مرحله 4: Neutralize migration‌های تکراری در repo
تبدیل فایل‌های fix migration به `SELECT 1;` تا pipeline بعدی مشکل نداشته باشد.

### مرحله 5: Publish

| عملیات | هدف |
|---|---|
| Dedup leads on Live | رفع بلاکر migration pipeline |
| Fix INSERT policy on Live | اجازه دادن به `workshop` برای CREATE DELIVERY |
| Fix UPDATE policy on Live | اجازه دادن به `workshop` برای بروزرسانی stops |
| Neutralize redundant migrations | جلوگیری از fail شدن publish بعدی |

