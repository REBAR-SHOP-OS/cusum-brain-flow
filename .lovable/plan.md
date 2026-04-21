

# حذف کامل قابلیت ساخت اکانت خودکار از Face Kiosk

## وضعیت فعلی (مشکل)
وقتی کیوسک Face Memory نتواند کسی را تشخیص دهد (`no_match` / `error` / `low_confidence`) یا وقتی کاربر روی «Not me» کلیک کند، کامپوننت `FirstTimeRegistration` ظاهر می‌شود که:
- اسم می‌گیرد
- در دیتابیس جستجو می‌کند (`kiosk-lookup`)
- اگر پیدا نکرد، **profile جدید می‌سازد و فوراً clock-in می‌کند** (`kiosk-register`)

این دقیقاً برخلاف خواستهٔ شماست — کیوسک باید **فقط اسکن و تطابق** انجام دهد.

## رفتار جدید (هدف)
- Scan Face → تطابق با enrollments موجود در Face Memory.
- اگر match: clock-in/out طبق روال فعلی.
- اگر **no match / error / low confidence**: فقط پیغام «شناخته نشد» نشان داده شود به همراه دکمهٔ Try Again. **هیچ مسیری برای ساخت اکانت یا ثبت‌نام جدید وجود ندارد.**
- ثبت افراد جدید فقط از طریق پنل **Face Memory → Add Person** (که قبلاً توسط ادمین انجام می‌شود) امکان‌پذیر است — این مسیر دست‌نخورده باقی می‌ماند.

## تغییرات کد (سرجیکال و حداقلی)

### 1. `src/pages/TimeClock.tsx`
- حذف import مربوط به `FirstTimeRegistration`.
- در حالت **kiosk** (خطوط ۳۵۲–۳۶۸): حذف کامل بلوک `showRegistration ? <FirstTimeRegistration ... /> : (no_match ...) ? <FirstTimeRegistration ... />`. به جایش، در همهٔ حالت‌ها `FaceRecognitionResult` رندر می‌شود (که از قبل برای `no_match` پیام «No Match Found» با دکمهٔ Try Again دارد).
- حذف prop `onNotMe` از `FaceRecognitionResult` (دیگر کاربردی ندارد چون مقصد آن باز کردن `FirstTimeRegistration` بود).
- حذف state `showRegistration` و هر setter مربوطه.
- در حالت **non-kiosk** (خطوط ۴۶۷–۴۷۳): حذف بلوک `face.state === "low_confidence"` که `FirstTimeRegistration` را رندر می‌کرد. در عوض، `low_confidence` هم به `FaceRecognitionResult` می‌رود.

### 2. `src/components/timeclock/FaceRecognitionResult.tsx`
- حذف prop و دکمهٔ `onNotMe` (دکمه‌ای که قبلاً registration را trigger می‌کرد).
- منطق `low_confidence`: به جای نشان ندادن چیزی (return null فعلی)، آن را مثل `no_match` نمایش بده با همان پیام «No Match Found / Try Again».

### 3. `src/components/timeclock/FirstTimeRegistration.tsx`
- **حذف کامل فایل** (دیگر هیچ‌کجا استفاده نمی‌شود).

### 4. Edge functions `kiosk-lookup` و `kiosk-register`
- **حذف کامل هر دو پوشه** از `supabase/functions/`. این دو فقط برای ساخت/lookup اکانت در flow ثبت‌نام خودکار بودند و دیگر هیچ caller-ای ندارند.
- ارجاع به `kiosk-lookup` در `src/lib/rolloutRegistry.ts` (فقط یک comment تاریخی) دست‌نخورده می‌ماند چون فقط متن یادداشت است، اثری در runtime ندارد.

## آنچه دست نمی‌خورد
- `face-recognize` edge function — همان‌طور باقی می‌ماند (فقط تطابق می‌دهد، اکانت نمی‌سازد).
- `kiosk-punch` edge function — همان‌طور باقی می‌ماند (پس از match صحیح، clock in/out می‌کند).
- `FaceMemoryPanel.tsx` و دکمهٔ **Add Person** آن — تنها مسیر مجاز برای ثبت کاربر جدید (توسط ادمین).
- `useFaceRecognition.ts` — تغییر نمی‌کند؛ همان state‌های `no_match`/`low_confidence`/`error` برمی‌گردد، فقط UI واکنشش متفاوت می‌شود.
- منطق kiosk fullscreen، sleep overlay، Memory button، و دکمهٔ Exit Kiosk — همه دست‌نخورده.

## اعتبارسنجی پس از اعمال
1. وارد `ai@rebar.shop` شوید → `/timeclock?kiosk=1` → دوربین فعال → دکمهٔ Scan Face دیده می‌شود.
2. صورت یک نفر **enrolled** را اسکن کنید → کارت تأیید match ظاهر می‌شود → clock-in/out اجرا می‌شود. (بدون تغییر)
3. صورت یک نفر **enroll نشده** را اسکن کنید → کارت قرمز «No Match Found» با پیام «Your face was not recognized. Please try again» و یک دکمهٔ Try Again. **هیچ فرم نام، جستجو، یا ساخت اکانت ظاهر نمی‌شود.**
4. در پنل Face Memory (دسترس رادین/ساتار/نیل) دکمهٔ Add Person کار می‌کند و افراد جدید را می‌توان دستی enroll کرد.
5. هیچ profile جدیدی به صورت خودکار از مسیر کیوسک ساخته نمی‌شود.

