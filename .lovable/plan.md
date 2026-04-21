

# بازگرداندن عکس Face Memory برای Kourosh

## یافته‌های تشخیصی

بررسی دیتابیس و storage نشان داد:

1. **پروفایل فعلی Kourosh**: `id=3ce7629d-0358-4f43-b910-1fde71b5f787`، email=`kourosh@rebar.shop`، **created_at=2026-04-21 12:28** (امروز ساخته شده).
2. **تعداد enrollment‌های فعال در DB**: صفر.
3. **تعداد عکس‌های متعلق به این profile_id در storage**: صفر.
4. **یافتهٔ کلیدی**: در bucket `face-enrollments` تعداد **15 پوشهٔ orphan** وجود دارد — متعلق به profile_id‌هایی که دیگر در جدول `profiles` نیستند. این یعنی پروفایل قبلی Kourosh (به همراه Behnam، Vicky و سایرین) قبلاً حذف شده و CASCADE رکوردهای `face_enrollments` را پاک کرده، اما **عکس‌های storage باقی مانده‌اند**.
5. هیچ ردی در `field_audit_trail` از profile_id قدیمی Kourosh وجود ندارد، پس از روی DB نمی‌توان مستقیماً تشخیص داد کدام پوشهٔ orphan متعلق به اوست.

## راه‌حل پیشنهادی: ابزار بازیابی بصری Orphan Photos

ساخت یک ابزار ادمین یک‌بارمصرف که:

1. **لیست 15 پوشهٔ orphan را با thumbnail عکس‌ها نمایش می‌دهد** (به ترتیب جدیدترین).
2. ادمین (Sattar/Radin/Zahra) از روی صورت تشخیص می‌دهد کدام متعلق به Kourosh است (و در صورت تمایل، سایر افراد).
3. روی پوشه کلیک می‌کند → یک dropdown از پروفایل‌های موجود نشان می‌دهد → ادمین `Kourosh Zand` را انتخاب می‌کند.
4. Edge function ادمینی **عکس‌ها را به profile_id جدید (`3ce7629d…`) منتقل می‌کند** (storage copy + insert در `face_enrollments`).
5. پس از تخصیص، Face Memory برای Kourosh دوباره فعال می‌شود.

## تغییرات کد

### 1. Edge function جدید: `supabase/functions/face-recover-orphans/index.ts`
- محافظت‌شده با `SUPER_ADMIN_EMAILS` از `_shared/accessPolicies.ts`.
- دو endpoint:
  - `GET /list` → لیست پوشه‌های orphan + signed URL هر عکس + تاریخ.
  - `POST /assign` → بدنه `{ orphanProfileId, targetProfileId }`. عکس‌ها را در storage کپی می‌کند به `targetProfileId/recovered-<timestamp>-<i>.jpg`، رکورد در `face_enrollments` با `is_active=true` می‌سازد، و پوشهٔ orphan را حذف می‌کند.

### 2. کامپوننت جدید: `src/components/timeclock/FaceMemoryRecoveryDialog.tsx`
- دیالوگی که با دکمهٔ «Recover Orphan Photos» در `FaceMemoryPanel.tsx` باز می‌شود (فقط برای super admins نمایش داده می‌شود).
- گرید thumbnail با ۳ عکس از هر پوشهٔ orphan.
- روی هر کارت، dropdown «Assign to…» با لیست پروفایل‌های موجود (sorted by name).
- دکمه‌های «Assign» و «Skip».
- بعد از assign، toast موفقیت + refresh پنل.

### 3. ویرایش جزئی: `src/components/settings/FaceMemoryPanel.tsx`
- اضافه کردن دکمهٔ «🔄 Recover Orphans (15)» در header (فقط super admin).
- باز کردن دیالوگ بالا.

## آنچه دست نمی‌خورد
- `face-recognize`, `kiosk-punch`, `useFaceRecognition.ts` — بدون تغییر.
- منطق enrollment فعلی، `FaceEnrollment.tsx` — بدون تغییر.
- Hard rule TimeClock Face-Only — بدون تغییر.
- هیچ migration دیتابیسی لازم نیست.

## اعتبارسنجی
1. Sattar وارد Settings → Face Memory می‌شود → دکمهٔ «Recover Orphans (15)» را می‌بیند.
2. کلیک می‌کند → دیالوگ با ۱۵ کارت ظاهر می‌شود (هر کدام ۱-۶ عکس).
3. صورت Kourosh را شناسایی می‌کند → از dropdown «Kourosh Zand» را انتخاب → Assign.
4. عکس‌ها به profile_id جدید Kourosh منتقل و در `face_enrollments` ثبت می‌شوند.
5. پنل Face Memory refresh می‌شود → Kourosh با ۳ photos نمایش داده می‌شود.
6. Kourosh به `/timeclock?kiosk=1` می‌رود → صورتش شناسایی می‌شود → punch موفق.
7. به‌صورت اختیاری ادمین می‌تواند سایر orphans (Behnam, Vicky و …) را هم به همین روش بازیابی کند.

