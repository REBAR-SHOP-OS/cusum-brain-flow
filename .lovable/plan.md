

# Hotfix: رفع فوری ارور `delivery_stops` در Loading Station (Production)

## مشکل تایید‌شده
وضعیت Production (Live) الان:
- آخرین migration اعمال‌شده: `20260304215226`
- Migration بعدی (`20260304234951`) به‌خاطر duplicate `odoo_id` در جدول `leads` fail می‌شود
- Policy فعلی `delivery_stops` برای INSERT: فقط `admin, office, field` — نقش **`workshop` ندارد**
- کاربران workshop وقتی CREATE DELIVERY می‌زنند، INSERT به `delivery_stops` با RLS reject می‌شود

## راه‌حل: دو عملیات مستقیم روی Production

### عملیات 1: Dedup leads (رفع بلاکر migration)
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

### عملیات 2: اضافه کردن `workshop` به policy INSERT
```sql
DROP POLICY IF EXISTS "Office staff insert delivery_stops" ON delivery_stops;
CREATE POLICY "Staff insert delivery_stops" ON delivery_stops
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::app_role[])
  );
```

### عملیات 3: Neutralize migration فایل‌های تکراری در repo
تبدیل 5 فایل migration تکراری به `SELECT 1;` تا pipeline بعدی fail نشود:
- `20260305031029...`
- `20260305144441...`
- `20260305150909...`
- `20260305155616...`
- `20260305161208...`

### عملیات 4: Publish
بعد از اجرای SQL روی Production و تمیز‌کردن migration ها، Publish برای sync کامل.

## جزئیات فنی
- عملیات 1 و 2 مستقیماً روی Production اجرا می‌شوند (via migration tool with production target)
- عملیات 3 فایل‌های repo را تمیز می‌کند تا migration chain در publish بعدی مشکل نداشته باشد
- هیچ تغییری در کد frontend یا فایل‌های auto-generated نمی‌شود

