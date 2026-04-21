

# Lock Time Clock to Face ID Memory — permanent, no toggle

## What the user wants (final, non-negotiable rule)
صفحه `/timeclock` در همه‌ی حالت‌ها و برای همه‌ی کاربران باید **فقط و فقط** از Face Memory برای clock in / clock out استفاده کند. سوییچ Face ID، حالت دستی، و دکمه‌های Clock In/Out دستی نباید وجود داشته باشند. این قانون ثابت است و دیگر قابل تغییر نیست.

## Current behavior (problem from screenshot)
- در اسکرین‌شات، `radin@rebar.shop` با سوییچ **Face ID = OFF** وارد شده و دکمه‌ی قرمز "Clock Out" دستی برایش نمایش داده می‌شود.
- سوییچ Face ID قابل خاموش/روشن کردن است (`handleFaceModeToggle`)، یعنی هر کسی می‌تواند به حالت دستی برگردد.
- وقتی `faceMode = false` باشد، شاخه‌ی manual UI کامل (Clock In/Out buttons) رندر می‌شود.
- این خلاف قانونی است که الان وضع شده.

## Fix (surgical, single file)

تنها فایل لمس‌شده: `src/pages/TimeClock.tsx`

1. **حذف کامل سوییچ Face ID از header** — کاربر نباید بتواند Face ID را خاموش کند.

2. **`faceMode` همیشه `true`** — تبدیل state به مقدار ثابت `const faceMode = true`. حذف `setFaceMode` و `handleFaceModeToggle`. دوربین در `useEffect` اولیه برای همه‌ی کاربران به‌صورت خودکار استارت می‌شود (نه فقط برای `ai@rebar.shop`).

3. **حذف کامل شاخه‌ی manual rendering** — بلوک `else` که Clock In/Out دستی را نشان می‌داد حذف می‌شود. فقط شاخه‌ی Face mode باقی می‌ماند (FaceCamera + Scan to Punch + recognition flow).

4. **حفظ تب‌های کناری** — Team Status / My Leave / Team Calendar / Payroll / Kiosk Status تغییری نمی‌کنند (فقط نمایش هستند، نه عمل clock).

5. **حفظ Kiosk auto-enter برای `ai@rebar.shop`** — این اکانت همچنان مستقیماً وارد fullscreen kiosk می‌شود (از قبل کار می‌کرد).

6. **حفظ FaceEnrollment / FaceMemoryPanel** — برای ثبت/حذف عکس‌های صورت دست‌نخورده می‌ماند (این‌ها setup هستند، نه clock action).

7. **حذف منطق `clockIn` / `clockOut` دستی از UI** — توابع در `useTimeClock` می‌مانند چون `handleScan` (مسیر Face) از طریق `kiosk-punch` edge function عمل می‌کند، که خودش clock in/out را مدیریت می‌کند. هیچ دکمه‌ای در صفحه نباید مستقیماً `clockIn` / `clockOut` را صدا بزند.

## Behavior after fix
- هر کاربری که وارد `/timeclock` شود (Radin، Sattar، Neel، Behnam، Vicky، Saurabh، Zahra، ai@…)، فقط دوربین + دکمه‌ی **Scan to Punch** را می‌بیند.
- اگر صورتش در Face Memory ثبت شده باشد → recognize → auto-punch (in یا out بسته به وضعیت فعلی).
- اگر صورتش ثبت نشده باشد → باید اول از طریق دکمه‌ی **Enroll Face ID** ثبت‌نام کند، سپس scan.
- هیچ راهی برای punch دستی وجود ندارد — حتی برای super admin.
- استثنا فقط در شاخه‌ی admin برای **clock-out اضطراری** کارمندان دیگر در تب Team Status باقی می‌ماند (دکمه‌ی LogOut کوچک کنار Zahra در اسکرین‌شات) — این برای موارد فراموشی ضروری است و قانون «همه از Face Memory» را برای punch خود کاربر نقض نمی‌کند.

## Memory rule to save
یک memory جدید ثبت می‌شود: `mem://features/timeclock/face-only-enforcement` — قانون hard که TimeClock فقط از Face Memory استفاده می‌کند، هیچ سوییچ یا fallback دستی برای punch خود کاربر مجاز نیست، و تنها استثنا admin emergency clock-out است.

## Files touched
- `src/pages/TimeClock.tsx` — حذف Face ID switch، حذف manual branch، `faceMode` ثابت true، auto-start camera برای همه.
- `mem://features/timeclock/face-only-enforcement` — memory جدید.
- `mem://index.md` — اضافه کردن یک خط Core برای این قانون.

## Untouched
- `useFaceRecognition`، `useTimeClock`، `face-recognize` edge function، `kiosk-punch` edge function، `face_enrollments` table، `FaceEnrollment`، `FaceMemoryPanel`، `FaceCamera`، `FaceRecognitionResult`، تب‌های Team/Leave/Calendar/Payroll/Kiosk Status.
- منطق admin emergency clock-out در Team Status.

## Validation
- لاگین با هر اکانتی → `/timeclock` فقط دوربین + Scan to Punch + لیست تب‌های کناری.
- دکمه‌ی قرمز "Clock Out" بزرگ در صفحه نیست.
- سوییچ Face ID در header نیست.
- اسکن صورت Radin → auto clock in/out → کارت ACTIVE در Team Status آپدیت می‌شود.
- کاربر بدون enrollment → پیام low_confidence + پنل ثبت‌نام.
- `ai@rebar.shop` همچنان مستقیم وارد kiosk fullscreen می‌شود.

