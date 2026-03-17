

## رفع مشکل اضافه نشدن آیتم دستی به لیست خرید

### ریشه مشکل
جدول `purchasing_list_items` در types تعریف شده ولی در تمام hook ها از `as any` استفاده شده. این باعث می‌شود Supabase client نتواند payload را درست validate کند و ممکن است insert بی‌صدا fail شود. همچنین بعد از `addItem`، تابع `refetch` باید await شود تا لیست به‌روز شود.

### تغییرات

**1. `src/hooks/usePurchasingList.ts`**
- حذف تمام `as any` از `supabase.from("purchasing_list_items" as any)` → `supabase.from("purchasing_list_items")`
- در `addItem`: اضافه کردن `return` مقدار success/failure تا caller بداند عملیات موفق بود
- بهبود error handling: لاگ کردن جزئیات خطا

**2. `src/hooks/usePurchasingDates.ts`**
- حذف `as any` از query ها

**3. `src/components/purchasing/PurchasingListPanel.tsx`**
- در `handleAdd`: اطمینان از `await refetch()` بعد از addItem
- اضافه کردن toast خطا اگر addItem fail شد

### فایل‌ها
- `src/hooks/usePurchasingList.ts` — حذف `as any`، بهبود error handling
- `src/hooks/usePurchasingDates.ts` — حذف `as any`
- `src/components/purchasing/PurchasingListPanel.tsx` — بهبود handleAdd

