

# اصلاح Cut Engine: حفظ تعداد bars و باقی ماندن روی صفحه آیتم پس از هر cut

## مشکل فعلی

دو رفتار اشتباه پس از هر cut:

1. **برگشت ناخواسته به Station Pool (#2):** پس از ۱.۵ ثانیه از تکمیل run، اپ خودکار به صفحه pool برمی‌گردد (`onBack?.()` در `handleCompleteRun`). اپراتور باید دوباره روی همان mark کلیک کند تا run بعدی را شروع کند.
2. **ریست شدن تعداد bars سوپروایزر:** اگر سوپروایزر از ۱۲ bar (پیشنهاد سیستم) به ۷ bar تغییر داد و LOCK & START زد، پس از تکمیل run اول، `operatorBars` به `null` ریست می‌شود و run بعدی دوباره به ۱۲ برمی‌گردد. سوپروایزر مجبور می‌شود هر بار دستی به ۷ تغییر دهد.

## رفتار مورد انتظار

- **بعد از هر cut → روی صفحه #1 (Mark detail) بمان**، نه pool.
- **انتخاب سوپروایزر برای bars حفظ شود** برای کل کار این mark، تا run آخری که `barsStillNeeded < operatorBars` می‌شود — آنجا خودکار به مقدار کمتر clamp شود (که الان از قبل کار می‌کند: `Math.min(operatorBars, ...)`).

## تغییرات

### فایل: `src/components/shopfloor/CutterStationView.tsx`

**۱) حذف auto-back در `handleCompleteRun`** (خطوط ۶۶۵–۶۶۸)

حذف بلاک:
```text
setTimeout(() => { onBack?.(); }, 1500);
```

جایگزین با:
- اگر mark کامل شد (`isMarkComplete === true`) و آیتم دیگری در صف نیست → `onBack?.()` بزن (رفتار فعلی برای پایان کار درست است).
- اگر mark کامل شد ولی آیتم دیگری وجود دارد → روی همین صفحه بمان، `currentIndex` تغییر نکند (اپراتور خودش انتخاب کند).
- اگر mark هنوز کامل نشده → روی همین صفحه بمان (هیچ navigation انجام نشود).

منطق نهایی:
```text
const allMarksDone = remaining <= 1 && isMarkComplete;
if (allMarksDone) {
  setTimeout(() => onBack?.(), 1500);
}
// otherwise: stay on this page
```

**۲) حفظ `operatorBars` بین runهای همان mark** (خط ۶۴۵)

حذف خط `setOperatorBars(null);` از `handleCompleteRun`.

این مقدار فقط زمانی باید null شود که:
- آیتم عوض شود (که از قبل در `useEffect` خط ۲۱۶ اتفاق می‌افتد — درست است، دست نمی‌خورد)
- run abort شود (خط ۴۶۷ — درست است، دست نمی‌خورد)

نتیجه: انتخاب سوپروایزر (۷) برای کل runهای این mark حفظ می‌شود. در run آخر که `barsStillNeeded` کمتر از ۷ می‌شود، خط ۲۹۸ خودکار clamp می‌کند:
```text
const barsForThisRun = operatorBars != null
  ? Math.max(1, Math.min(operatorBars, maxBars))
  : (runPlan?.barsThisRun ?? autoBarsToLoad);
```
این منطق درست است و هیچ تغییری نیاز ندارد.

⚠️ نکته: `barsForThisRun` فقط `maxBars` را در نظر می‌گیرد، نه `barsStillNeeded`. باید این را به‌روزرسانی کنیم تا run آخر اضافه‌بار نگیرد:

```text
const barsForThisRun = operatorBars != null
  ? Math.max(1, Math.min(operatorBars, maxBars, barsStillNeeded))
  : (runPlan?.barsThisRun ?? autoBarsToLoad);
```

این تضمین می‌کند:
- اگر سوپروایزر ۷ انتخاب کرده و ۳ bar دیگر کافی است → run بعدی فقط ۳ bar می‌گیرد (نه ۷).
- در غیر این صورت، انتخاب ۷ حفظ می‌شود.

### فایل: `src/components/shopfloor/CutEngine.tsx`

**۳) جلوگیری از reset شدن `bars` و `operatorOverride` بین runها**

در `useEffect` خط ۷۷–۸۲:
```text
useEffect(() => {
  if (!isRunning) {
    setOperatorOverride(false);
    barsLocked.current = false;
  }
}, [barCode, isRunning]);
```

این effect موقع تمام شدن run (`isRunning` از true به false) همه چیز را ریست می‌کند، حتی اگر `barCode` (یعنی mark) تغییر نکرده باشد. این باعث می‌شود وقتی parent دوباره render کند، مقدار default را بنشاند.

اصلاح: فقط وقتی `barCode` تغییر کرد ریست کن:
```text
useEffect(() => {
  setOperatorOverride(false);
  barsLocked.current = false;
}, [barCode]);
```

و در parent (`CutterStationView`)، `suggestedBars` که به CutEngine پاس داده می‌شود باید اولویت با `operatorBars` داشته باشد (که از قبل احتمالاً همینطور است — تأیید می‌شود حین اجرا).

## محدوده تغییر

تغییر می‌کند:
- `src/components/shopfloor/CutterStationView.tsx` — حذف auto-back، حذف ریست `operatorBars`، اضافه شدن `barsStillNeeded` به clamp
- `src/components/shopfloor/CutEngine.tsx` — وابستگی effect ریست از `[barCode, isRunning]` به `[barCode]`

تغییر **نمی‌کند**:
- منطق slot tracker
- منطق `manageMachine` و edge functions
- RLS / database
- بقیه stationها (bender, loader)
- سایر کامپوننت‌های shop floor

## مراحل اجرا (پس از تأیید)

1. حذف `setTimeout(onBack, 1500)` در `handleCompleteRun` و جایگزینی با شرط mark-complete + last-mark
2. حذف `setOperatorBars(null)` از `handleCompleteRun` (خط ۶۴۵)
3. اضافه کردن `barsStillNeeded` به clamp در `barsForThisRun` (خط ۲۹۸)
4. تغییر وابستگی useEffect در `CutEngine.tsx` از `[barCode, isRunning]` به `[barCode]`
5. تست end-to-end:
   - یک mark با ۷۲ pieces، ۲ pieces/bar → نیاز به ۳۶ bar در ۳ run (۱۲+۱۲+۱۲ یا ۷+۷+۷+...)
   - سوپروایزر ۷ را انتخاب می‌کند → LOCK & START
   - بعد از run اول: روی صفحه mark بماند، bars همچنان ۷ نشان دهد، نه ۱۲
   - run آخر: bars خودکار به مقدار کمتر clamp شود اگر کمتر نیاز است
   - وقتی mark کامل شد و آیتم دیگری نیست → برگشت به pool

## اعتبارسنجی

- ✅ پس از تکمیل cut، صفحه mark باز می‌ماند (نه pool)
- ✅ انتخاب ۷ bar توسط سوپروایزر برای runهای بعدی همان mark حفظ می‌شود
- ✅ run آخر خودکار به `barsStillNeeded` clamp می‌شود (اضافه‌بار نمی‌کند)
- ✅ تغییر mark یا abort هنوز bars را ریست می‌کند (رفتار درست)
- ✅ پایان کامل همه marks → برگشت خودکار به pool حفظ می‌شود

