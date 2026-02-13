

# رفع خطای سینک Odoo و محدودسازی به ۵ روز اخیر

## مشکلات شناسایی‌شده

1. ستون `probability` در دیتابیس از نوع `integer` است ولی ادو مقادیر اعشاری مثل `97.54` برمی‌گرداند. این باعث خطای `invalid input syntax for type integer` می‌شود.
2. فانکشن تمام opportunityها را یکجا دریافت می‌کند که باعث تایم‌اوت و خطای "Failed to send request" می‌شود.

## تغییرات

### فایل: `supabase/functions/odoo-crm-sync/index.ts`

1. فیلتر `write_date` اضافه شود تا فقط رکوردهایی که در ۵ روز اخیر تغییر کرده‌اند دریافت شوند:
   - دامنه فیلتر: `["write_date", ">=", "YYYY-MM-DD 00:00:00"]`
2. مقدار `probability` قبل از insert/update با `Math.round()` به عدد صحیح تبدیل شود
3. مقدار `expected_value` هم با `Number()` تبدیل شود تا مشکل نوع داده نداشته باشیم

### جزییات فنی

```text
تغییرات در odooRpc call:
  domain = [
    ["type", "=", "opportunity"],
    ["write_date", ">=", "5 days ago"]
  ]

تغییرات در insert/update:
  probability: Math.round(ol.probability || 0)
  expected_value: Number(ol.expected_revenue) || 0
```

### نتیجه
- سینک سریع‌تر (فقط ۵ روز اخیر به جای همه)
- بدون تایم‌اوت
- بدون خطای نوع داده
- تکراری‌ها از طریق `odoo_id` در metadata مدیریت می‌شوند (بدون تغییر)
