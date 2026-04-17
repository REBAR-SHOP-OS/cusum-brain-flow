
## درخواست کاربر
در ProVideoEditor همیشه بخش **Transitions** قابل دسترس باشد تا بتوان بین کلیپ‌ها ترنزیشن اضافه کرد، با template های مختلف.

## بررسی فعلی

`TransitionsTab.tsx` از قبل وجود دارد با کاتالوگ کامل (Fades, Wipes, Motion). نیاز است:
1. مطمئن شوم این tab همیشه در sidebar editor قابل دسترس است
2. ترنزیشن انتخاب‌شده **per-clip** ذخیره شود (نه فقط global) تا کاربر بتواند بین هر دو کلیپ متوالی ترنزیشن متفاوت بگذارد
3. هنگام export/stitch، ترنزیشن‌ها اعمال شوند

## بررسی کد لازم

باید این فایل‌ها را بررسی کنم:
- `src/components/ad-director/ProVideoEditor.tsx` — sidebar tabs کجاست، چطور TransitionsTab وصل است
- `src/lib/videoStitch.ts` — آیا transition پشتیبانی می‌کند؟
- ساختار `clips` در `backgroundAdDirectorService.ts` — آیا فیلد `transition` per-clip دارد؟

## برنامه پیشنهادی

### 1. UI: Transitions Tab همیشه در دسترس
- در sidebar (یا tabs panel) ProVideoEditor، یک tab ثابت "Transitions" اضافه/تثبیت شود
- کنار هر کلیپ در timeline یک آیکن کوچک ⇄ نمایش دهد که با کلیک، TransitionsTab را برای آن نقطه‌ی اتصال (junction) باز کند
- نوار جداکننده‌ی بین دو کلیپ روی timeline، نشان‌دهنده‌ی نوع transition انتخاب‌شده باشد (با gradient/icon)

### 2. State: per-clip transition
- در `Clip` type، فیلد `transitionIn?: { type: string; duration: number }` اضافه شود
- selected junction در state محلی editor نگهداری شود
- ذخیره از طریق همان `service.patchState({ clips })` که الان وجود دارد

### 3. Stitch pipeline (Export)
- در `videoStitch.ts`، حلقه‌ی trim/concat به ازای هر کلیپ، اگر `transitionIn` دارد، یک بازه‌ی overlap با کلیپ قبلی ایجاد کند و افکت canvas (crossfade / wipe / slide) اعمال کند
- شروع: فقط Crossfade و Fade Black را پیاده‌سازی می‌کنیم (پرکاربردترین). بقیه‌ی template ها در UI می‌مانند ولی هنگام stitch به crossfade fallback می‌شوند با toast اطلاع‌رسانی
- مدت پیش‌فرض: 0.5s

### 4. حفظ سازگاری
- اگر کلیپی `transitionIn` ندارد → cut ساده (رفتار فعلی)
- خروجی دانلودی برای کلیپ‌های قدیمی بدون تغییر
- زبان UI: کاملاً انگلیسی (طبق memory rule)

## آنچه دست‌نخورده می‌ماند
- منطق clips، storyboard، scene generation
- DB / RLS / edge functions
- Pipeline تولید اولیه‌ی video
- Drag & drop reorder موجود

## نتیجه
1. ✅ Transitions tab همیشه در sidebar editor قابل دسترس
2. ✅ کلیک بین دو کلیپ روی timeline → انتخاب transition
3. ✅ نمایش بصری transition بین کلیپ‌ها در timeline
4. ✅ هنگام Save/Download، crossfade/fade-black واقعاً اعمال می‌شود
5. ✅ سایر template ها در UI نمایش داده می‌شوند (preview gradient) و در stitch به crossfade map می‌شوند

قبل از شروع کد، باید دو فایل کلیدی را بررسی کنم تا dock points دقیق sidebar tabs و ساختار stitch loop را پیدا کنم. این کار در حالت اجرا انجام می‌شود.
