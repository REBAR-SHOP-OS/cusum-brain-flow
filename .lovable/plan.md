

# رفع مشکل Invoice # / Invoice Date و بلاکر Publish

## دو مشکل موجود

### مشکل ۱: بلاکر Publish
Migration `20260305000039` سعی می‌کند unique index بسازد **قبل از** اینکه migration `20260305175234` رکوردهای تکراری را حذف کند. ترتیب اجرا اشتباه است.

**راه‌حل**: dedup SQL را داخل همان migration `20260305000039` و **قبل از** CREATE INDEX قرار می‌دهیم. Migration دوم (`175234`) را خالی می‌کنیم.

### مشکل ۲: Invoice # و Invoice Date خالی در Preview
Packing slip‌های قبلی بدون `invoice_number` و `invoice_date` ذخیره شده‌اند. کد جدید LoadingStation فقط برای slip‌های **جدید** کار می‌کند.

**راه‌حل**: در `DeliveryTerminal.tsx`، وقتی slip بارگذاری می‌شود و `invoice_number` یا `invoice_date` خالی است، یک query فالبک اجرا شود:

```
packing_slips.cut_plan_id → cut_plan_items → work_orders → orders
```

از آنجا `order_number` و `order_date` خوانده و به عنوان invoiceNumber/invoiceDate نمایش داده شود.

## فایل‌های تغییر یافته

| فایل | تغییر |
|---|---|
| `supabase/migrations/20260305000039_...sql` | اضافه کردن dedup قبل از CREATE INDEX |
| `supabase/migrations/20260305175234_...sql` | خالی کردن (دیگر لازم نیست) |
| `src/pages/DeliveryTerminal.tsx` | فالبک query برای invoice data از cut_plan_items → orders |

