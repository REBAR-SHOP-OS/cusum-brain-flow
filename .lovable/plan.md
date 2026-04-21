

# اسکن خودکار + فقط در صورت نشناختن، درخواست نام

## مشکل فعلی
کیوسک Face ID فعلاً منتظر کلیک کاربر روی دکمهٔ **Scan Face** می‌ماند. کاربر باید به‌صورت دستی scan را trigger کند. همچنین گزینهٔ "Type My Name" حتی قبل از تلاش برای اسکن هم در دسترس قرار می‌گیرد (پس از error/no_match).

## رفتار جدید

### فاز ۱ — اسکن خودکار و دقیق
1. ورود به کیوسک → دوربین **به‌صورت خودکار** فعال می‌شود (بدون نیاز به کلیک).
2. پس از آماده شدن دوربین (~۱ ثانیه برای stabilization)، اسکن **به‌صورت خودکار** آغاز می‌شود.
3. اگر تشخیص confidence پایین داشت یا fail شد، سیستم **به‌صورت خودکار تا ۳ بار** تلاش مجدد می‌کند (با فاصلهٔ ۱.۵ ثانیه بین هر تلاش) تا به نتیجهٔ قطعی برسد.
4. در طول اسکن، overlay واضح "Scanning..." با انیمیشن دایرهٔ نقطه‌چین نمایش داده می‌شود.

### فاز ۲ — فقط در صورت شکست قطعی
- پس از ۳ تلاش ناموفق (یا `no_match` صریح)، کارت قرمز نمایش داده می‌شود با دو دکمه:
  - **Try Again** → ریست و شروع مجدد چرخهٔ اسکن خودکار
  - **Type My Name** → ورود به فرم انتخاب نام (مسیر فعلی `ManualNameFallback`)
- در حالت `matched` یا `low_confidence` بالا (۷۵٪+)، رفتار فعلی حفظ می‌شود (auto-punch countdown یا دکمهٔ تأیید).

## تغییرات کد

### 1. `src/pages/TimeClock.tsx` (بخش kiosk، خطوط ~۳۲۰–۴۲۰)
- اضافه کردن `useEffect` که در mount کیوسک:
  - `face.startCamera()` را خودکار فراخوانی می‌کند.
  - پس از ۱ ثانیه delay (برای stabilization دوربین)، `face.recognize()` را trigger می‌کند.
- اضافه کردن state `attemptCount` (شمارندهٔ تلاش‌های خودکار، حداکثر ۳).
- `useEffect` دوم که وقتی `face.state === "no_match"` یا `"error"` و `attemptCount < 3`:
  - پس از ۱.۵ ثانیه delay، `face.recognize()` دوباره اجرا می‌شود.
  - `attemptCount` افزایش می‌یابد.
- وقتی `attemptCount >= 3` یا state `matched`/`low_confidence` شد، چرخهٔ خودکار متوقف می‌شود.
- ریست `attemptCount` در `handleConfirmPunch` و `face.reset()`.
- **حذف یا مخفی کردن** دکمهٔ دستی **Scan Face** در حالت kiosk (چون اسکن خودکار است). در حالت non-kiosk دست‌نخورده باقی می‌ماند.
- دکمهٔ **Try Again** (در `FaceRecognitionResult`) باید `attemptCount = 0` و `face.reset()` کند تا چرخهٔ خودکار از نو شروع شود.

### 2. `src/components/timeclock/FaceRecognitionResult.tsx`
- بدون تغییر رفتاری — همان دکمه‌های Try Again + Type My Name حفظ می‌شوند.
- (اختیاری) نمایش متن "Attempt 2 of 3..." در حالت scanning بین تلاش‌ها برای شفافیت.

### 3. `src/components/timeclock/FaceCamera.tsx`
- بدون تغییر — قبلاً `scanning` overlay را پشتیبانی می‌کند.

## آنچه دست نمی‌خورد
- `useFaceRecognition.ts` — منطق capture/recognize کاملاً حفظ می‌شود.
- `face-recognize` و `kiosk-punch` edge functions.
- `ManualNameFallback.tsx` — همان کامپوننت موجود استفاده می‌شود.
- حالت non-kiosk (`/timeclock` بدون `?kiosk=1`) — رفتار فعلی (دکمهٔ دستی Scan Face) حفظ می‌شود.
- `FaceMemoryPanel.tsx`, `accessPolicies.ts` — بدون تغییر.

## اعتبارسنجی
1. باز کردن `/timeclock?kiosk=1` → دوربین خودکار روشن می‌شود → پس از ~۱ ثانیه اسکن خودکار آغاز می‌شود.
2. صورت enrolled → match → کارت تأیید + auto-punch.
3. صورت ناشناس → ۳ بار تلاش خودکار (با indicator "Attempt X of 3") → نمایش کارت قرمز با دکمه‌های Try Again و Type My Name.
4. کلیک Try Again → چرخهٔ خودکار از نو.
5. کلیک Type My Name → فرم انتخاب نام (بدون تغییر).
6. در `/timeclock` بدون kiosk → رفتار فعلی (دکمهٔ دستی) حفظ.

