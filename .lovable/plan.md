

# دیباگ مشکل ثبت نشدن قطعات در Cutter Station

## مشکل یافت‌شده
بررسی دیتابیس نشان می‌دهد آیتم مورد نظر (mark `x`, 10M, 710mm, 12 قطعه) هنوز `completed_pieces = 0` دارد. یعنی RPC اتمیک `increment_completed_pieces` یا اصلا فراخوانی نشده یا بی‌صدا فِیل شده.

## علت احتمالی
در `handleRecordStroke` (خط 337-347) فراخوانی RPC به صورت **fire-and-forget** انجام می‌شود — خطاها فقط به `console.error` می‌روند و هیچ toast یا UI feedback به اپراتور نمایش داده نمی‌شود. اگر RPC فِیل شود، اپراتور متوجه نمی‌شود.

## راه‌حل — `src/components/shopfloor/CutterStationView.tsx`

### تغییر ۱: تبدیل fire-and-forget به await با toast خطا
در `handleRecordStroke`، فراخوانی RPC را از `.then()` به `await` تبدیل می‌کنیم و در صورت خطا toast نمایش داده شود تا اپراتور بداند ثبت ناموفق بوده.

### تغییر ۲: اضافه کردن console.log برای دیباگ
لاگ کردن `activeBars`, `currentItem.id`, و `completedAtRunStart` قبل از فراخوانی RPC تا بتوانیم ببینیم آیا مقادیر درست هستند.

### تغییر ۳: حذف شرط `completedAtRunStart !== null` 
این شرط ممکن است در برخی حالات مانع فراخوانی RPC شود. فقط `currentItem` کافی است.

