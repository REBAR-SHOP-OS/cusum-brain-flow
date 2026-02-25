

## رفع خطای حذف مشتری - NOT NULL constraint روی orders

### مشکل
ستون `customer_id` در جدول `orders` به صورت `NOT NULL` تعریف شده، اما FK آن `ON DELETE SET NULL` است. هنگام حذف مشتری، دیتابیس سعی می‌کند `customer_id` را NULL کند ولی constraint اجازه نمی‌دهد.

همین مشکل احتمالاً برای جداول دیگر هم وجود دارد (`quotes`, `leads`, `communications`, `tasks`, `delivery_stops`, `pickup_orders`, `estimation_projects`, `accounting_mirror`, `recurring_transactions`).

### راه‌حل
یک migration اجرا شود که ستون `customer_id` را در تمام جداولی که FK آنها `ON DELETE SET NULL` است، nullable کند:

```sql
ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.quotes ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.communications ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.delivery_stops ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.pickup_orders ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.estimation_projects ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.accounting_mirror ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.recurring_transactions ALTER COLUMN customer_id DROP NOT NULL;
```

### نتیجه
- حذف مشتری بدون خطا انجام می‌شود
- سفارشات و فاکتورهای قبلی حفظ می‌شوند (فقط `customer_id` آنها NULL می‌شود)
- بدون تغییر کد فرانت‌اند

