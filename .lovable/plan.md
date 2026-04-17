
## مشکل کاربر
وقتی یک نوار ویدئو split می‌شود، الان دو کارت **جداگانه** ساخته می‌شود (با ring، border، status badge، duration label، gap بین‌شان). کاربر می‌خواهد همان نوار قبلی **در همان جا به دو قسمت** تقسیم شود — مثل یک تکه نوار با یک خط برش عمودی، نه دو کارت مستقل کنار هم.

## یافته‌ی فنی

در `TimelineBar.tsx` (خط 689-693) Video Track یک `<div>` اصلی است با `gap-px` بین اسلات‌ها. هر scene یک wrapper مستقل دارد (خط 707) با:
- `ring-1 ring-white/[0.06]` (border دور هر کارت)
- `rounded-sm` (گوشه‌های گرد جدا)
- status badge "(done/gen…/idle)" در بالا-راست
- duration badge "Xs" در بالا-چپ
- objective text در پایین

نتیجه: بعد از split، کاربر دو "کارت" مستقل می‌بیند که با گپ کوچک و borders جدا شده‌اند — درست مثل دو scene جداگانه. logic split کاملاً درست است (segments و clipDurations درست به‌روزرسانی می‌شوند، widths متناسب هستند) — فقط **رندر بصری** هر دو نیمه را به شکل دو کارت کامل نشان می‌دهد.

## برنامه‌ی اصلاح (Surgical, Visual-Only)

### ۱. اضافه کردن مفهوم "split sibling" در `handleSplitScene`
به scene جدید (نیمه‌ی دوم) یک flag اختیاری اضافه کنیم:
```ts
const newScene: StoryboardScene = { 
  ...scene, 
  id: newSceneId, 
  segmentId: newSegId,
  splitFromId: scene.id,  // ← جدید
};
```
و scene اصلی هم flag بگیرد:
```ts
const updatedOriginal = { ...scene, splitIntoId: newSceneId };
```

### ۲. در `TimelineBar.tsx` — نمایش continuous برای split siblings
هنگام render هر scene wrapper، اگر scene فعلی یا قبلی `splitFromId/splitIntoId` به یکدیگر دارند:
- **حذف gap**: `gap-px` فقط بین scene های غیر-sibling (با محاسبه‌ی margin به‌جای gap container-level)
- **حذف border بین آن‌ها**: ring فقط روی edge های بیرونی (left edge اولی، right edge دومی)
- **یکپارچه کردن thumbnails**: سری پشت‌سرهم thumbnails ها به نظر یکپارچه (با `rounded-none` در edge داخلی)
- **خط برش بصری**: یک divider قرمز ۲px در نقطه‌ی برش بین دو نیمه (به جای gap)
- **حذف badge های تکراری**: duration و status badge فقط روی نیمه‌ی selected شده (یا اولی)
- **selection highlight**: ring قرمز روی نیمه‌ی selected، نه روی هر دو

### ۳. تغییر container بیرونی video track
به جای `gap-px` ثابت، از یک منطق conditional استفاده می‌کنیم:
```tsx
<div className={`... ${isSplitSibling(scene, prev) ? "ml-0" : "ml-px"}`}>
```
یا ساده‌تر: هر pair از split-siblings داخل یک wrapper مشترک قرار می‌گیرند.

### ۴. UX کوچک: highlight cut line
وقتی playhead روی نقطه‌ی split است (یا hover روی divider)، خط برش پررنگ‌تر شود — feedback بصری که "این جا برش است".

## فایل‌های تغییرکننده
- `src/components/ad-director/ProVideoEditor.tsx` — اضافه کردن `splitFromId`/`splitIntoId` به scene جدید و قبلی در `handleSplitScene`
- `src/components/ad-director/editor/TimelineBar.tsx` — منطق رندر continuous برای split siblings (بدون gap، بدون border داخلی، divider قرمز، badge مشترک)
- `src/types` یا inline type — افزودن دو فیلد اختیاری به `StoryboardScene` (یا cast محلی، چون فقط visual است)

## آنچه دست‌نخورده می‌ماند
- منطق split (segments, clipDurations, clip duplication) — کاملاً صحیح، تغییر نمی‌کند
- export/stitch pipeline — همان دو scene مستقل را پردازش می‌کند (هر کدام startTime/endTime خود)
- drag/reorder/trim/delete — کار می‌کنند روی هر نیمه به‌طور مستقل
- DB / RLS / edge functions — بدون تغییر
- Audio & Text tracks — بدون تغییر

## نتیجه
1. ✅ بعد از split، کاربر یک نوار continuous با thumbnails پیوسته می‌بیند
2. ✅ یک خط برش قرمز نازک در نقطه‌ی playhead وجود دارد
3. ✅ کلیک روی هر نیمه آن نیمه را select می‌کند (با ring قرمز فقط روی selected)
4. ✅ از نظر داده، هنوز دو scene مستقل هستند (قابل drag، trim، delete جداگانه)
5. ✅ هیچ تغییری در export/stitch pipeline نیاز نیست
6. ✅ زبان UI: انگلیسی (طبق memory rule)
