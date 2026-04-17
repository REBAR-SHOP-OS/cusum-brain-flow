

## چرا «Recovering missing scenes...» ظاهر می‌شود؟

### علت

این پیام یک **bug** نیست — یک **feature برای auto-recovery** است. در `AdDirectorContent.tsx` خط 207-243، تابع `handleSelectProjectDraft` وقتی فعال می‌شود که شما روی یک **پروژه ذخیره‌شده قبلی** از لیست drafts کلیک می‌کنید (نه پروژه کاملاً جدید).

منطق آن:
1. لیست scenes پروژه را چک می‌کند
2. برای هر scene بررسی می‌کند آیا یک clip موفق با `videoUrl` معتبر دارد یا نه
3. اگر **همه** scenes کامل باشند → مستقیم به result می‌رود ✅
4. اگر **حتی یک scene** ناقص باشد (status ≠ completed یا videoUrl ندارد) → آن‌ها را `failed` علامت می‌زند و recovery شروع می‌شود → پیام «Recovering missing scenes...» نمایش داده می‌شود

### چرا scenes ناقص می‌شوند؟

پروژه‌های شما ممکن است scene ناقص داشته باشند به این دلایل:
- **Generation قبلی نیمه‌کاره ماند** — مثلاً tab بسته شد، شبکه قطع شد، یا cancel زدید قبل از تکمیل همه scenes
- **یک scene در DashScope/Wan engine fail شد** ولی پروژه ذخیره شد
- **Timeout** روی یکی از clipها (Wan 2.6 گاهی >2 دقیقه طول می‌کشد)
- **Blob URL منقضی شد** — اگر videoUrl یک blob: URL موقت بوده باشد و در DB ذخیره شده (نه permanent storage URL)، بعد از reload صفحه آن URL دیگر معتبر نیست

### چه زمانی این اتفاق می‌افتد (الگو)

- وقتی روی یک **draft قدیمی** در لیست projects کلیک می‌کنید
- نه وقتی پروژه جدید می‌سازید
- معمولاً برای پروژه‌هایی که status آن‌ها `draft` یا `incomplete` است

### آیا این مشکل است؟

این auto-recovery درست کار می‌کند و هدف آن نجات پروژه‌های ناقص است. ولی اگر شما مرتباً این پیام را می‌بینید، یعنی scenes شما در نقطه‌ای از pipeline به جای completion، نیمه‌کاره ذخیره می‌شوند.

### اگر می‌خواهید این رفتار تغییر کند، گزینه‌ها:

1. **Status badge به جای auto-recovery** — وقتی draft ناقص انتخاب می‌شود، یک badge "Incomplete (X/Y scenes)" نشان داده شود و کاربر دکمه «Resume» را خودش بزند (به جای شروع خودکار)
2. **بهبود نمایش progress** — به جای «Recovering missing scenes...» جزئیات نشان داده شود: "Re-generating scene 3 of 5 (was missing)"
3. **بررسی root cause** — چک کنیم چرا scenes اصلاً ناقص ذخیره می‌شوند (مثلاً ثبت blob URL به جای permanent URL در DB)

اگر می‌خواهید یکی از این تغییرات را اعمال کنم، بفرمایید کدام را ترجیح می‌دهید.

