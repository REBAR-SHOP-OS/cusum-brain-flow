

## حذف فیلد "Slip #" از Packing Slip

### مشکل
در Packing Slip تولید شده از صفحه `/deliveries`، فیلد "Slip #" نمایش داده می‌شود که باید حذف گردد.

### فایل تغییریافته

**`src/components/delivery/DeliveryPackingSlip.tsx`**

در ردیف دوم info grid (خطوط 99-117)، فیلد "Slip #" آخرین ستون از grid چهارتایی است. تغییرات:

1. حذف بلوک `<div>` مربوط به "Slip #" (خطوط 112-116)
2. تغییر grid از `grid-cols-4` به `grid-cols-3` در ردیف دوم، چون حالا فقط 3 فیلد باقی می‌ماند (Invoice #, Invoice Date, Scope)

### جزئیات فنی

| خط | قبل | بعد |
|----|------|------|
| 99 | `grid-cols-4` | `grid-cols-3` |
| 112-116 | بلوک Slip # | حذف کامل |

پراپ `slipNumber` نیز می‌تواند از interface حذف شود اما برای سازگاری با کدهای فراخوانی‌کننده فعلاً نگه داشته می‌شود.
