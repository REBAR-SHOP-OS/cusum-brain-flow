

# رفع مشکل عدم تشخیص صورت + تثبیت Face Memory به‌عنوان منبع یکتا

## تشخیص

از بررسی کد و اسکرین‌شات‌ها:

### مشکل ۱: مدام «No Match» می‌دهد
- فانکشن `face-recognize` (در `supabase/functions/face-recognize/index.ts`) از مدل **Gemini** برای تطبیق چهره استفاده می‌کند.
- بر اساس runtime errors فعلی، **GEMINI_API_KEY فعلی توسط Google leaked تشخیص داده شده** و فانکشن‌های مرتبط (vizzy-daily-brief، احتمالاً face-recognize هم) با `403 — Your API key was reported as leaked` fail می‌شوند.
- وقتی AI call شکست می‌خورد، فانکشن `face-recognize` به‌جای error واضح، نتیجه را به‌عنوان "no match" یا confidence پایین برمی‌گرداند → کاربر مدام پیام «نتونستم مچ بکنم» می‌بیند.
- ضمناً اگر confidence < 50 یا API fail شود، state به `no_match` می‌رود (در `useFaceRecognition.ts` خط ~110).

### مشکل ۲: Face Memory باید **همیشه** منبع یکتا باشد
- بر اساس memory `mem://features/timeclock/face-only-enforcement` که قبلاً تعریف شده: «`/timeclock` punch is exclusively via Face Memory for every user. No Face ID toggle, no manual Clock In/Out buttons, no fallback».
- اما در اسکرین‌شات اول می‌بینیم که در داشبورد TimeClock، یک `ManualNameFallback` (Type My Name) وجود دارد و در `FaceRecognitionResult.tsx` نیز گزینهٔ `onManualFallback` به‌صورت پیش‌فرض نمایش داده می‌شود — این **نقض قانون hard-rule** است.
- هرچند memory می‌گوید «manual name fallback allowed only AFTER face-scan failure»، اما کاربر صراحتاً تأکید کرده که **«همیشه و همیشه و همیشه از Face Memory استفاده شود»** — یعنی fallback به typing name باید کاملاً حذف شود (به‌جز برای ادمین در emergency clock-out که از Team Status انجام می‌شود، نه از kiosk).

## راه‌حل دو-بخشی

### بخش ۱: رفع ریشه‌ای مشکل تشخیص — کلید Gemini سالم
بدون کلید Gemini سالم، **هیچ تغییر کدی نمی‌تواند مشکل «نتونستم مچ بکنم» را حل کند**، چون مدل AI اصلاً پاسخ نمی‌دهد. اقدامات:

1. **رفع کلید**: کلید جدید Gemini که در پیام قبلی تنظیم کردید نیز توسط Google blacklist شده. باید:
   - به https://aistudio.google.com/apikey بروید.
   - **یک پروژهٔ Google Cloud کاملاً جدید** بسازید (نه پروژهٔ قبلی).
   - در آن پروژه یک API key جدید generate کنید.
   - کلید را **هرگز** در هیچ فایل/چت/screenshot قرار ندهید.
   - با ابزار update-secret کلید را برای `GEMINI_API_KEY` ذخیره کنید.

2. **مقاوم‌سازی `face-recognize`**: اضافه کردن fallback خودکار به OpenAI GPT-5 (vision-capable) در صورت 403 از Gemini. چون `aiRouter.ts` در پیام قبلی به‌روزرسانی شد و حالا روی 403 fallback می‌کند، فقط باید مطمئن شویم `face-recognize` از `aiRouter` با `fallback: true` استفاده می‌کند (نه fetch مستقیم Gemini).

### بخش ۲: حذف کامل Manual Name Fallback از Face ID Kiosk
طبق درخواست صریح کاربر، Face Memory باید **تنها منبع** تشخیص باشد:

1. **`src/components/timeclock/FaceRecognitionResult.tsx`**:
   - حذف prop `onManualFallback` و دکمهٔ "Type My Name" از حالت‌های `no_match` / `error` / `low_confidence`.
   - فقط دکمهٔ "Try Again" باقی می‌ماند.
   - متن error به این تغییر می‌کند: «Face not recognized. Please look at the camera and try again. If the problem persists, ask an admin to re-enroll your face.»

2. **`src/pages/TimeClock.tsx`** (یا هرجا kiosk render می‌شود):
   - حذف import و render شرطی `ManualNameFallback`.
   - حذف state مرتبط (`showManualFallback` و …).
   - prop `onManualFallback` دیگر به `FaceRecognitionResult` پاس داده نمی‌شود.

3. **`src/components/timeclock/ManualNameFallback.tsx`**:
   - فایل **حفظ می‌شود** (دست نمی‌خورد) چون ممکن است در آینده برای ادمین در Team Status استفاده شود — اما از مسیر kiosk حذف کامل می‌شود.

4. **بهبود حلقهٔ Auto-retry در kiosk**:
   - در `useFaceRecognition.ts`، پس از `no_match` (نه error)، یک auto-retry سریع (مثلاً ۲ ثانیه delay و سپس scan مجدد) اضافه می‌شود تا کاربر مجبور به کلیک نباشد.
   - حداکثر ۳ تلاش متوالی، سپس پیام «لطفاً صورت را در مرکز فریم نگه دارید» با دکمهٔ Try Again دستی.

### بخش ۳: به‌روزرسانی Memory
- memory `mem://features/timeclock/face-only-enforcement` به‌روزرسانی می‌شود تا منعکس کند: **«manual name fallback fully removed from kiosk; Face Memory is the only path»**.

## آنچه دست نمی‌خورد
- منطق enrollment (Face Memory panel، Recover Orphans، Add Person) — بدون تغییر.
- Edge function `face-enroll` — بدون تغییر.
- Team Status و emergency admin clock-out — بدون تغییر.
- ساختار `useFaceRecognition.ts` — فقط auto-retry اضافه می‌شود، API ثابت می‌ماند.

## فایل‌های تغییر یافته
1. `supabase/functions/face-recognize/index.ts` — استفاده از `aiRouter` با fallback.
2. `src/components/timeclock/FaceRecognitionResult.tsx` — حذف دکمهٔ Type My Name.
3. `src/pages/TimeClock.tsx` (یا kiosk container) — حذف ManualNameFallback از flow.
4. `src/hooks/useFaceRecognition.ts` — auto-retry روی no_match.
5. `mem://features/timeclock/face-only-enforcement.md` — به‌روزرسانی قانون.
6. **Secret**: `GEMINI_API_KEY` — کلید جدید از پروژهٔ Google Cloud جدید.

## اعتبارسنجی
1. کاربر `/timeclock?kiosk=1` را باز می‌کند → دوربین فعال → اسکن خودکار.
2. صورت Kourosh تشخیص داده می‌شود (چون 3 enrollment معتبر دارد) → punch موفق.
3. اگر Gemini fail کند، fallback به GPT-5 تشخیص را حفظ می‌کند → بدون «no match» اشتباه.
4. هیچ‌کجا دکمهٔ "Type My Name" نمایش داده نمی‌شود.
5. در صورت no_match واقعی، 3 retry خودکار سپس پیام راهنما + Try Again.

