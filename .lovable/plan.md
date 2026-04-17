
## مشکل کاربر
وقتی روی نوار ویدئو، playhead روی یک نقطه قرار می‌گیرد و دکمه Split زده می‌شود، انتظار این است:
- روی نوار ویدئو، در همان نقطه‌ی playhead، یک برش بصری ظاهر شود
- یک کارت جدید برای نیمه‌ی دوم ساخته شود
- هر دو کارت مدت‌زمان درست (نسبت به نقطه‌ی برش) را نشان دهند

## مشکلات شناسایی‌شده در کد فعلی

در `ProVideoEditor.tsx` دو تابع `handleSplitScene` تعریف شده — تابع دوم (خط 1038) تابع اول (خط 938) را override می‌کند:

### باگ ۱: محاسبه‌ی غلط نقطه‌ی برش (خط 1045)
```ts
const splitAt = currentTime;  // ❌ این global time است نه offset داخل scene
```
باید مثل تابع اول (خط 946) از `globalTime - cumulativeStarts[index]` استفاده کند تا offset واقعی داخل scene انتخاب‌شده محاسبه شود.

### باگ ۲: کلیپ جدید ساخته نمی‌شود (خط 1066-1069)
Scene جدید فقط در storyboard اضافه می‌شود ولی هیچ entry جدیدی در آرایه‌ی `clips` ساخته نمی‌شود (هیچ `onDuplicateClip` صدا زده نمی‌شود). نتیجه: کارت دوم خالی/no-video نشان داده می‌شود.

### باگ ۳: هر دو کلیپ کل ویدئوی اصلی را نشان می‌دهند
چون `clipDurations[scene.id]` از طول ویدئوی واقعی (مثلاً ۸ ثانیه) خوانده می‌شود نه از segment timing، حتی بعد از split، هر دو scene می‌گویند "من ۸ ثانیه‌ام". نتیجه: روی timeline دو کارت با pull duration دیده می‌شوند و هیچ برش بصری ای روی نوار ظاهر نمی‌شود.

## برنامه‌ی اصلاح (Surgical)

### ۱. حذف تابع `handleSplitScene` تکراری (خط 1038-1073)
نگه داشتن نسخه‌ی اول (خط 938) که محاسبه‌ی split را درست انجام می‌دهد.

### ۲. تکمیل تابع باقی‌مانده با سه افزوده
در همان تابع اول:
- **ساخت clip جدید**: فراخوانی `onDuplicateClip?.(scene.id, newSceneId)` بعد از insert در storyboard (دقیقاً مثل `handleDuplicateScene`).
- **lock کردن duration برای هر دو half**: بعد از split، فوراً مقدار جدید را در `clipDurations` state بنویسیم تا visualization بر اساس segment timing باشد نه طول ویدئوی اصلی:
  ```ts
  setClipDurations(prev => ({
    ...prev,
    [scene.id]: splitPoint,
    [newSceneId]: sceneDur - splitPoint,
  }));
  ```
- **انتخاب اتوماتیک scene جدید**: `setSelectedSceneIndex(index + 1)` و `setCurrentTime(0)` تا playhead روی شروع کارت دوم منتقل شود.

### ۳. Update `sceneDurations` memo
این تغییر نیاز به اصلاح memo ندارد — وقتی `clipDurations` برای دو scene جدید با مقادیر برش‌شده پر شد، `sceneDurations` خودکار درست می‌شود و دو کارت با عرض‌های متناسب روی timeline ظاهر می‌شوند.

### ۴. حذف keyboard shortcut تکراری
خط 808 از `handleSplitScene` تکراری استفاده می‌کند — بعد از حذف، خودکار به نسخه‌ی صحیح اشاره می‌کند.

## فایل‌های تغییرکننده
- `src/components/ad-director/ProVideoEditor.tsx` — حذف تابع تکراری + افزودن سه خط به تابع اصلی

## آنچه دست‌نخورده می‌ماند
- ساختار `Clip` type
- DB / RLS / edge functions
- منطق playback، seek، scrub
- Stitch pipeline (segments timing درست export می‌شوند)
- دیگر action ها (duplicate, trim, delete, move)

## نتیجه‌ی پس از اصلاح
1. ✅ Playhead روی scene قرار می‌گیرد → دکمه Split → دقیقاً در همان نقطه برش بصری روی نوار ظاهر می‌شود
2. ✅ کارت دوم با همان ویدئو اما scene id جدید ساخته می‌شود
3. ✅ عرض هر دو کارت روی timeline متناسب با duration برش‌شده‌شان است
4. ✅ playhead به ابتدای کارت دوم منتقل می‌شود تا کاربر فوراً ببیند کجا هست
5. ✅ undo/redo از طریق `pushHistory` کار می‌کند (موجود)
6. ✅ زبان UI: کاملاً انگلیسی (طبق memory rule)
