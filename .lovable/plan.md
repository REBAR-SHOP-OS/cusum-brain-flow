

## درخواست کاربر
وقتی آیکون **Split** ✂️ زده می‌شود، clip ویدئویی فعلی باید دقیقاً در محل **playhead** (خط پیکان عمودی) به دو قسمت مستقل تقسیم شود — هر دو نیمه به‌عنوان clip مجزا در timeline ظاهر شوند و playback پیوسته باقی بماند.

## بررسی موردنیاز
- `TimelineBar.tsx` — جایی که Split toolbar button و playhead position render می‌شوند
- `ProVideoEditor.tsx` — handler فعلی Split، state کلیپ‌ها (`storyboard`, `clips`)، و playhead time

## برنامه

### ۱. شناسایی clip زیر playhead
- `currentTime` (سراسری timeline) را داریم
- بر اساس `scene.duration` تجمعی، تشخیص دهیم playhead روی کدام scene قرار دارد و offset داخلی چقدر است (`localT = currentTime - sceneStart`)
- اگر `localT < 0.2s` یا `localT > duration - 0.2s` → split نکنیم (خیلی نزدیک به edge، toast: "Move playhead inside a clip to split")

### ۲. ساخت دو scene جدید
- scene اصلی را با دو scene جدید جایگزین کنیم در `storyboard`:
  - `sceneA`: همان scene با `duration = localT`، `id = ${original.id}-a`
  - `sceneB`: کپی scene با `duration = original.duration - localT`، `id = ${original.id}-b`
  - تمام field های دیگر (prompt, voiceover, imagePrompt, ...) duplicate شوند
- در `clips`: clip مربوطه را با دو entry جایگزین کنیم:
  - هر دو نیمه به همان `videoUrl` اشاره کنند (URL مشترک)
  - فیلد `clipStartOffset` (جدید، اختیاری) اضافه شود برای نیمه‌ی دوم تا preview بداند از کجا پخش کند
  - alternatively: `targetDuration` همان قسمت + `startOffset` در playback

### ۳. Playback با offset
در preview player وقتی به clip جدید (نیمه‌ی دوم) می‌رسد:
```ts
video.src = clip.videoUrl;
video.currentTime = clip.startOffset ?? 0;  // seek به نقطه‌ی split
video.play();
// onTimeUpdate: اگر video.currentTime >= startOffset + targetDuration → next clip
```
- یعنی هر clip یک `startOffset` و `targetDuration` دارد و player به‌جای تکیه بر `onEnded`، روی `timeupdate` چک می‌کند که از window خارج شده یا نه.

### ۴. به‌روزرسانی Tracks وابسته
- **Voice track** آن scene: اگر voice به scene اصلی متصل بود، فقط به نیمه‌ی اول (`sceneA`) نسبت داده شود (نیمه‌ی دوم voice ندارد) — یا کاربر بعداً regenerate کند
- **Text overlays / captions**: 
  - اگر overlay دارای `startTime/endTime` در scene بود، بر اساس `localT` بین دو نیمه تقسیم شود
  - overlay های ساده (بدون timing): به نیمه‌ی اول منتقل شوند
- **Music**: سراسری است، تغییری نمی‌کند
- **clipTransitions**: transition بین `sceneA` و `sceneB` پیش‌فرض `None` (cut)؛ transition بعد از scene اصلی به‌صورت طبیعی به `sceneB` منتقل می‌شود

### ۵. UI و feedback
- دکمه‌ی Split (آیکون قیچی موجود در toolbar — همان دایره‌ی قرمز در screenshot) فقط زمانی فعال شود که `currentTime` داخل یک clip معتبر باشد
- بعد از split: یک خط عمودی کوتاه روی timeline در محل cut نمایش داده شود (visual marker) و scene انتخاب‌شده روی `sceneB` ست شود تا کاربر context را گم نکند
- toast: `"Clip split at 4.2s"`

## فایل‌های تغییرکننده
- `src/components/ad-director/ProVideoEditor.tsx`:
  - `handleSplit` جدید/بازنویسی: محاسبه‌ی محل split، dup کردن scene/clip
  - Player loop: اضافه کردن `startOffset` handling در `onTimeUpdate`
- `src/components/ad-director/editor/TimelineBar.tsx`:
  - فعال/غیرفعال کردن دکمه‌ی Split بر اساس playhead validity
  - (اختیاری) marker visual بعد از split
- نوع `Clip` (احتمالاً در همان file): اضافه‌کردن فیلد اختیاری `startOffset?: number`

## آنچه دست‌نخورده می‌ماند
- Veo / Wan / Sora generation flow
- DB schema / RLS
- Music / Audio extraction
- Transition system (فقط جدول state به‌روز می‌شود)
- Export pipeline (در محدوده‌ی اعمال offset روی stitch — اگر export از همان `clips` array استفاده کند، startOffset باید در stitch هم respect شود؛ در غیر این صورت TODO جداگانه)
- زبان UI: انگلیسی

## نتیجه‌ی مورد انتظار
1. ✅ کلیک روی Split → clip فعلی دقیقاً در playhead به دو قسمت تقسیم می‌شود
2. ✅ هر دو نیمه به‌عنوان block مستقل در Video lane دیده می‌شوند
3. ✅ Preview بدون قطعی پیوسته پخش می‌شود (نیمه‌ی دوم با seek به offset)
4. ✅ Text/Voice متناسب با split بین دو نیمه تقسیم می‌شوند
5. ✅ Split نزدیک edge جلوگیری می‌شود تا clip 0-second ساخته نشود

