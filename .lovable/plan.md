
# علت: SlotTracker و Stock Length فقط mm را hardcode کرده‌اند

## ریشهٔ مشکل

در `src/components/shopfloor/CutterStationView.tsx` و `src/components/shopfloor/SlotTracker.tsx`:

1. **DB canonical = mm**: `cut_plan_items.cut_length_mm` همیشه میلی‌متر است (storage standard). ۵۸ اینچ = `1473mm` در DB ذخیره شده.
2. **نمایش بزرگ "58 IN" درست است** (خط ۹۱۹ CutterStationView): از `currentItem.source_total_length_text` می‌خواند که متن اصلی فایل را نگه می‌دارد، و label هم بر اساس وجود `"` یا `'` به IN/FT/MM سوییچ می‌کند.
3. **اما SlotTracker و Stock panel هنوز mm-only هستند**:
   - `SlotTracker.tsx` خط ۹۶: `{slot.cutsDone} cuts · {leftover}mm left` — برچسب hardcoded `mm`.
   - `SlotTracker.tsx` خط ۱۱۶: dialog حذف bar هم `({...}mm)` می‌گوید.
   - `CutterStationView.tsx` خط ۵۲: `useState(12000)` — stock length پیش‌فرض mm.
   - Bar size panel و Stock length tabs (6M/12M/18M) همه فرض می‌کنند ورودی متریک است.
   - محاسبات `selectedStockLength - cutsDone * cut_length_mm` در همان واحد mm درست‌اند، ولی **نمایش** unit-aware نیست.

پس اعداد محاسباتی غلط نیستند (همه در mm درست محاسبه می‌شوند)، فقط **برچسب نمایش** برای آیتم imperial گمراه‌کننده است.

## تغییر

**فقط لایهٔ نمایش، بدون دست زدن به محاسبات یا DB.**

### ۱. تشخیص unit از روی آیتم
در `CutterStationView.tsx` نزدیک خط ۸۸۰ (قبل از render SlotTracker) یک flag محلی:
```ts
const isImperial = !!currentItem.source_total_length_text &&
  (currentItem.source_total_length_text.includes('"') || currentItem.source_total_length_text.includes("'"));
const displayUnit: UnitSystem = isImperial ? "imperial" : "metric";
```
و آن را به SlotTracker پاس می‌دهیم: `<SlotTracker ... displayUnit={displayUnit} />`.

### ۲. SlotTracker
- اضافه کردن prop اختیاری `displayUnit?: UnitSystem` (default `"metric"`).
- import `formatLengthShort` از `@/lib/unitSystem`.
- خط ۹۶: 
  ```tsx
  {slot.cutsDone} cuts · {displayUnit === "imperial" 
    ? formatLengthShort(leftover, "imperial") 
    : `${leftover}mm`} left
  ```
- خط ۱۱۶ (dialog) و خط ۲۹۷+ (removable bars warning) همان pattern.

### ۳. (اختیاری، در همین تغییر) Stock length tabs
چون imperial-mark معمولاً با bar 20'/40'/60' کار می‌کند، وقتی `displayUnit==="imperial"` متن tab‌ها را به `20'`, `40'`, `60'` نمایش بده ولی **مقدار state همچنان mm** بماند (6096 / 12192 / 18288). این یک تغییر کوچک در `CutEngine` panel است.

## چه چیزی دست نمی‌خورد
- `cut_length_mm`، `stock_length_mm`، RLS، triggers، schema.
- منطق `useSlotTracker` (همه به mm).
- ذخیرهٔ remnant و run notes (می‌توانیم در آینده دو-واحدی کنیم؛ خارج از scope این fix).
- نمایش بزرگ "58 IN" که قبلاً درست بود.

## اعتبارسنجی
1. در همین صفحه (Mark A1001، طول 58"): ردیف bar باید نشان دهد `0 cuts · 39'-4" left` (به‌جای `12000mm left`).
2. بعد از یک stroke: `1 cuts · 34'-6" left` (تقریبی).
3. آیتم متریک (مثلاً Mark با `source_total_length_text = "1500"` یا null): همچنان `…mm left` نمایش داده شود.
4. شمارش پیس‌ها، remnant detection، و `STOP/Complete` بدون تغییر کار کنند.

## خلاصهٔ یک‌خطی
`cut_length_mm` در DB واحد mm است (درست). تنها مشکل، **برچسب** mm hardcoded در `SlotTracker` است؛ با پاس دادن `displayUnit` از `source_total_length_text` و استفاده از `formatLengthShort`، نمایش به ft-in تبدیل می‌شود بدون تغییر در منطق.
