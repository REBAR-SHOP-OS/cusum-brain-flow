

# Manual Name Fallback for Face ID Failure

## رفتار جدید
وقتی Face ID نتواند صورتی را تشخیص دهد (`no_match` / `error` / `low_confidence`)، علاوه بر دکمهٔ **Try Again**، یک دکمهٔ ثانویه **Type My Name** نمایش داده می‌شود. این دکمه فرمی باز می‌کند که:

1. کارمند بخشی از **نام** خود را تایپ می‌کند.
2. سیستم لیست enrolled افراد در Face Memory را با تطابق **case-insensitive substring** فیلتر می‌کند.
3. فقط profile‌هایی که حداقل یک enrollment فعال در `face_enrollments` دارند نمایش داده می‌شوند.
4. اگر هیچ تطابقی نبود: پیغام «No enrolled employee found».
5. اگر تطابق‌ها وجود داشت: کارت‌هایی با avatar + full name نمایش داده می‌شود.
6. کارمند روی نام خودش کلیک می‌کند → کارت تأیید ظاهر می‌شود با دکمهٔ **Clock In** یا **Clock Out**.
7. تأیید → فراخوانی همان `kiosk-punch` edge function → punch ثبت می‌شود.

## محدودیت‌ها (Anti-Abuse)
- دکمهٔ «Type My Name» فقط بعد از شکست Face ID ظاهر می‌شود — هرگز به‌عنوان مسیر اصلی.
- فقط افرادی که در Face Memory (جدول `face_enrollments`) ثبت شده‌اند قابل انتخاب هستند.
- افراد بدون enrollment اصلاً در لیست ظاهر نمی‌شوند.

## به‌روزرسانی قانون Hard Rule
قانون `mem://features/timeclock/face-only-enforcement` به‌روزرسانی می‌شود تا fallback نام‌محور فقط پس از شکست Face ID و فقط برای کاربران enrolled مجاز باشد.

## تغییرات کد

### 1. کامپوننت جدید: `src/components/timeclock/ManualNameFallback.tsx`
- یک input field برای تایپ نام.
- Query به `face_enrollments` (join با `profiles`) برای گرفتن لیست افراد enrolled.
- فیلتر client-side بر اساس متن تایپ‌شده (case-insensitive substring match).
- نمایش کارت‌های تطابق‌یافته با avatar و نام.
- کلیک روی هر کارت → callback به parent با `profileId` انتخاب‌شده.
- دکمهٔ Back برای بازگشت به صفحهٔ اسکن.

### 2. ویرایش: `src/components/timeclock/FaceRecognitionResult.tsx`
- اضافه کردن prop جدید `onManualFallback: () => void`.
- در بلوک `no_match` / `error` / `low_confidence`: اضافه کردن دکمهٔ **Type My Name** کنار دکمهٔ **Try Again**.

### 3. ویرایش: `src/pages/TimeClock.tsx`
- اضافه کردن state `showManualFallback` (boolean).
- در بخش kiosk: وقتی `showManualFallback === true`، رندر `ManualNameFallback` به جای `FaceRecognitionResult`.
- وقتی کاربر از `ManualNameFallback` یک profile انتخاب کرد، همان `handleConfirmPunch(profileId)` فراخوانی می‌شود.
- وقتی کاربر Back می‌زند، `showManualFallback = false` و `face.reset()`.

### 4. ویرایش: `mem://features/timeclock/face-only-enforcement.md`
- به‌روزرسانی قانون: fallback نام‌محور پس از شکست Face ID فقط برای enrolled users مجاز است.

## آنچه دست نمی‌خورد
- `face-recognize` edge function
- `kiosk-punch` edge function (همان endpoint استفاده می‌شود)
- `FaceMemoryPanel.tsx` و `FaceEnrollment.tsx`
- `useFaceRecognition.ts`
- هیچ migration دیتابیسی لازم نیست — فقط read از `face_enrollments` + `profiles`

## اعتبارسنجی
1. در کیوسک، Face scan → شکست → کارت قرمز ظاهر می‌شود با **Try Again** + **Type My Name**.
2. کلیک **Type My Name** → فرم نام → تایپ «Kou» → کارت «Kourosh Zand» ظاهر → کلیک → تأیید clock in/out.
3. تایپ نام فردی که enroll نشده → «No enrolled employee found».
4. بدون شکست Face ID، دکمهٔ Type My Name در دسترس نیست.

