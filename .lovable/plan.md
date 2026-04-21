

# افزودن اسکرول کامل به دیالوگ Recover Orphan Photos

## مشکل
در دیالوگ بازیابی، کارت‌های پایین‌تر (مثلاً ردیف چهارم به بعد) قابل دیدن نیستند چون `ScrollArea` به‌درستی scroll نمی‌کند و کاربر نمی‌تواند به ته لیست برسد.

## علت ریشه‌ای
در `FaceMemoryRecoveryDialog.tsx`:
- `DialogContent` دارای `max-h-[90vh] flex flex-col` است (درست).
- `ScrollArea` دارای `flex-1 p-6` است.
- اما کامپوننت `ScrollArea` از Radix برای scroll درست شدن نیاز دارد که فرزندش (`Viewport`) ارتفاع مشخص داشته باشد. `flex-1` به تنهایی روی `ScrollArea` ممکن است باعث شود ارتفاع داخلی به‌درستی محاسبه نشود و overflow بدون scrollbar اتفاق بیفتد، یا کارت‌ها از پایین cut شوند.

## تغییر

### `src/components/timeclock/FaceMemoryRecoveryDialog.tsx`
- جایگزینی `<ScrollArea className="flex-1 p-6">` با یک `<div>` ساده با `overflow-y-auto`:
  ```tsx
  <div className="flex-1 overflow-y-auto p-6">
    {/* همان محتوا */}
  </div>
  ```
- این روش روی `flex-1` در parent flex container قابل اطمینان scroll می‌سازد و در تمام مرورگرها کار می‌کند.
- `DialogContent` همان `max-h-[90vh] flex flex-col` می‌ماند.
- Header (`DialogHeader`) همان sticky-by-flex می‌ماند (بالا ثابت).

## آنچه دست نمی‌خورد
- منطق fetch / assign / delete — بدون تغییر.
- Edge function `face-recover-orphans` — بدون تغییر.
- `FaceMemoryPanel.tsx` — بدون تغییر.
- ساختار کارت‌ها، grid، dropdown، دکمه‌ها — بدون تغییر.

## اعتبارسنجی
1. باز کردن دیالوگ Recover Orphans → ۱۵ کارت در گرید ۲ ستونه نمایش داده می‌شوند.
2. اسکرول عمودی روان کار می‌کند تا انتهای لیست (تمام ۸ ردیف).
3. Header بالا ثابت می‌ماند.
4. عملکرد Assign / Delete بدون تغییر.

