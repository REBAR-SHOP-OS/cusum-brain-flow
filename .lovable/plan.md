

# رفع مشکل Invoice # و Invoice Date در Packing Slip

## مشکل
هنگام ساخت packing slip در Loading Station، فیلدهای `invoice_number` و `invoice_date` اصلاً مقداردهی نمی‌شوند و خالی (—) نمایش داده می‌شوند.

## ریشه مشکل
در `src/pages/LoadingStation.tsx` خطوط 153-168، insert به جدول `packing_slips` شامل `invoice_number` و `invoice_date` **نیست**.

## راه‌حل
مسیر دیتا وجود دارد: `cut_plans → cut_plan_items → work_orders → orders`

در Loading Station، **قبل از insert packing slip**، یک query اضافه می‌شود:

```typescript
// Query order data for invoice fields
const { data: orderData } = await supabase
  .from("cut_plan_items")
  .select("work_orders(orders(order_number, order_date))")
  .eq("cut_plan_id", selectedBundle.cutPlanId)
  .not("work_order_id", "is", null)
  .limit(1)
  .maybeSingle();

const order = (orderData as any)?.work_orders?.orders;
const invoiceNumber = order?.order_number || null;
const invoiceDate = order?.order_date
  ? new Date(order.order_date).toISOString().slice(0, 10)
  : null;
```

سپس در insert، دو فیلد اضافه می‌شود:

```typescript
invoice_number: invoiceNumber,
invoice_date: invoiceDate,
```

## فایل تغییر یافته
| فایل | تغییر |
|---|---|
| `src/pages/LoadingStation.tsx` | اضافه کردن query برای order_number/order_date و مقداردهی invoice_number/invoice_date در insert packing_slips |

**نکته**: این تغییر فقط برای packing slip‌های **جدید** اعمال می‌شود. Slip‌های قبلی همچنان خالی خواهند بود مگر دستی آپدیت شوند.

