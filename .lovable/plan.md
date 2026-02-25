
## رفع خطای حذف بارلیست - Foreign Key Constraint

### مشکل
هنگام حذف بارلیست، خطای `work_orders_barlist_id_fkey` رخ می‌دهد چون `work_orders` با `ON DELETE RESTRICT` (پیش‌فرض) به `barlists` متصل است.

کد فعلی سعی می‌کند قبل از حذف بارلیست، رکوردهای `work_orders` مرتبط را حذف کند، اما در برخی موارد (مثلاً race condition یا work order های دیگر) این کافی نیست.

### راه‌حل
تغییر constraint `work_orders_barlist_id_fkey` از `RESTRICT` به `SET NULL` تا هنگام حذف بارلیست، فیلد `barlist_id` در work orders به NULL تنظیم شود (work order حذف نشود ولی ارتباطش با بارلیست قطع شود).

### تغییرات

#### 1. Migration دیتابیس
```sql
ALTER TABLE public.work_orders
  DROP CONSTRAINT work_orders_barlist_id_fkey;

ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_barlist_id_fkey
  FOREIGN KEY (barlist_id) REFERENCES public.barlists(id) ON DELETE SET NULL;
```

#### 2. ساده‌سازی کد حذف در `ProductionQueueView.tsx`
- حذف خط `supabase.from("work_orders").delete().eq("barlist_id", barlistId)` از `handleDeleteBarlist` چون دیگر نیازی نیست - دیتابیس خودش `SET NULL` می‌کند.
- همچنین حذف حلقه مشابه از `handleDeleteProject`.

### نتیجه
- حذف بارلیست بدون خطا انجام می‌شود
- Work orders مرتبط حفظ می‌شوند ولی `barlist_id` آنها NULL می‌شود
- کد ساده‌تر و قابل اعتمادتر می‌شود
