

## مشکل کاربر
وقتی در ProVideoEditor یک aspect ratio انتخاب می‌شود (16:9, 9:16, 1:1), preview frame دقیقاً به آن نسبت drawn نمی‌شود. علت:

1. در خط 1951، container دو constraint متناقض دارد: `flex-1` (می‌خواهد همه‌ی فضای موجود را بگیرد) + `aspectRatio` style + `max-h-[60vh]`. `flex-1` بر `aspect-ratio` غلبه می‌کند → frame دقیقاً به نسبت انتخاب‌شده نمی‌رسد.
2. ویدئوی source خودش 16:9 است؛ وقتی کاربر 9:16 یا 1:1 انتخاب می‌کند، ویدئو با `object-contain` letterbox می‌شود — اما frame بیرونی هم correct نیست (به‌جای پر‌شدن، ابعاد نسبت اصلی container را می‌گیرد).
3. ابعاد `RATIO_DIMS` فعلی برای social standards بهینه نیستند: 9:16 social = 1080×1920, 1:1 social = 1080×1080, 16:9 = 1920×1080.

## برنامه‌ی اصلاح (Surgical, Visual-Only)

### ۱. اصلاح container preview
در `ProVideoEditor.tsx` خط 1948-1951:
- حذف `flex-1` از container ویدئو (این علت اصلی است)
- تبدیل به wrapper دو لایه:
  - **Outer wrapper**: `flex-1 flex items-center justify-center` (فقط برای centering)
  - **Inner frame**: ابعاد ثابت بر اساس aspect ratio با `max-h-[60vh]` و `max-w-full` و `aspect-[…]` صریح
- این تضمین می‌کند frame دقیقاً به نسبت انتخاب‌شده render شود

### ۲. بهبود `object-fit` ویدئو
وقتی aspect source ≠ aspect frame:
- پیش‌فرض: `object-contain` (letterbox سیاه — استاندارد social preview)
- مزیت: کاربر می‌بیند دقیقاً چطور روی Instagram/TikTok دیده می‌شود

### ۳. به‌روزرسانی RATIO_DIMS به social standards
```ts
const RATIO_DIMS: Record<string, [number, number]> = {
  "16:9": [1920, 1080],   // YouTube, LinkedIn landscape
  "9:16": [1080, 1920],   // Instagram Reels, TikTok, YouTube Shorts
  "1:1":  [1080, 1080],   // Instagram feed
};
```

### ۴. پس‌زمینه‌ی frame
داخل frame، یک layer با `bg-black` تا letterbox نواحی به‌صورت تمیز سیاه دیده شوند (مانند social preview واقعی).

### ۵. نمایش badge ابعاد روی frame (اختیاری ولی مفید)
گوشه‌ی frame یک badge کوچک `1080×1920 · 9:16` نشان دهد تا کاربر بداند export نهایی همین ابعاد را دارد.

## فایل‌های تغییرکننده
- `src/components/ad-director/ProVideoEditor.tsx` — فقط بخش preview frame (خط ~1948-2024)

## آنچه دست‌نخورده می‌ماند
- منطق overlay drag/resize (همان درصدی نسبت به container) — کار می‌کند چون نسبت‌ها relative هستند
- export pipeline / stitch / timeline / clips
- سایر UI و بخش‌های editor

## نتیجه
1. ✅ انتخاب 9:16 → frame عمودی واقعی 1080×1920 رسم می‌شود
2. ✅ انتخاب 1:1 → frame مربعی 1080×1080
3. ✅ انتخاب 16:9 → frame افقی 1920×1080
4. ✅ ویدئوی source با object-contain داخل frame letterbox می‌شود (دقیقاً مطابق social preview)
5. ✅ زبان UI: انگلیسی

