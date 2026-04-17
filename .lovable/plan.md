

## ریشه‌ی مشکل — تأیید‌شده

وقتی کاربر روی **Edit Video** می‌زند، کامپوننت `ProVideoEditor` باز می‌شود. این editor در همان لحظه‌ی mount **سه چیز را به‌صورت اتوماتیک به ویدیو تزریق می‌کند**:

| منبع | چه می‌کند | فایل/خط |
|---|---|---|
| `useEffect` auto-seed logo | برای هر scene یک overlay **لوگو** اضافه می‌کند (اگر `brand.logoUrl` وجود داشته باشد) | `ProVideoEditor.tsx` خط 595-617 |
| `useEffect` auto-seed captions | متن هر `segment` را به chunk های 4-5 کلمه‌ای می‌شکند و به‌صورت **subtitle overlay زمان‌بندی‌شده** روی ویدیو می‌گذارد | `ProVideoEditor.tsx` خط 648-664 |
| `useEffect` auto-generate VO | تابع `generateAllVoiceovers()` را صدا می‌زند → برای متن همه‌ی segmentها **TTS voiceover** می‌سازد و به audioTracks اضافه می‌کند | `ProVideoEditor.tsx` خط 666-674 |

**نتیجه:** ویدیوی خام تولید‌شده با صدا و کپشن و لوگو روی editor باز می‌شود — کاربر هیچ‌گاه چنین چیزی نخواسته است.

## انتظار کاربر
وقتی **Edit Video** زده می‌شود، باید **همان clipهای خام** بدون صدای اضافه‌شده و بدون متن نوشته‌شده روی ویدیو باز شوند. اگر کاربر بخواهد صدا یا کپشن اضافه کند، از tab های **Voiceover / Subtitle / Brand Kit** خودش اضافه می‌کند (این tab ها از قبل وجود دارند).

---

## برنامه‌ی اصلاحی (یک فایل، سطحی)

### فایل: `src/components/ad-director/ProVideoEditor.tsx`

**حذف هر سه auto-seed effect:**

1. **خط 594-617** — حذف `useEffect` که اتوماتیک logo overlay اضافه می‌کند. کاربر از tab **Brand Kit** خودش لوگو می‌گذارد.

2. **خط 647-664** — حذف `useEffect` که از `segment.text` کپشن‌های زمان‌بندی‌شده می‌سازد. کاربر از tab **Subtitle** خودش زیرنویس اضافه می‌کند.

3. **خط 666-674** — حذف `useEffect` که `generateAllVoiceovers()` را اتوماتیک صدا می‌زند. کاربر از tab **Voiceover** خودش صدا می‌سازد. (ref `voiceoverGenerated` هم بدون استفاده می‌شود → حذف.)

### آنچه دست‌نخورده می‌ماند
- خود توابع `generateAllVoiceovers`, `buildTimedOverlays`, `splitIntoChunks` و دکمه‌های Voiceover/Subtitle/Brand Kit — **همه باقی می‌مانند** تا کاربر در صورت نیاز دستی استفاده کند.
- tab های editor، playback، export، regenerate scene — هیچ تغییری.
- منطق پایپلاین اصلی، CHARACTER LOCK، intro/outro cards — هیچ تغییری.
- DB و RLS — هیچ تغییری.

---

## نتیجه پس از اصلاح

با کلیک روی **Edit Video**:
1. ✅ ویدیوهای scene **خام** نمایش داده می‌شوند — بدون voiceover خودکار
2. ✅ هیچ کپشن/زیرنویسی روی ویدیو ظاهر نمی‌شود
3. ✅ هیچ logo overlay اتوماتیکی اضافه نمی‌شود
4. ✅ کاربر می‌تواند با tab های Voiceover / Subtitle / Brand Kit در صورت نیاز خودش اضافه کند
5. ✅ Export نهایی هم بدون audio/text تزریق‌شده انجام می‌شود (مگر کاربر دستی اضافه کند)

