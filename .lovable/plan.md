
هدف شما کاملا روشن است: وقتی کاربر روی Clock Out می‌زند باید واقعا در دیتابیس ثبت شود و همان لحظه دکمه به Clock In برگردد؛ و برعکس.

Do I know what the issue is? بله.

مسئله ریشه‌ای که پیدا شد:
1) در حال حاضر برای بعضی کاربرها چندین Open Shift قدیمی همزمان وجود دارد (داده‌های تاریخی قبل از Trigger جدید).  
2) کد `clockOut` فقط یک رکورد را با `id = activeEntry.id` می‌بندد. اگر کاربر 2+ Open Shift داشته باشد، بعد از Clock Out هنوز یک رکورد باز می‌ماند، پس UI دوباره Clock Out نشان می‌دهد.  
3) در مسیر Face/Kiosk هم همین مشکل وجود دارد (فقط یک رکورد بسته می‌شود).  
4) Auto clock-out ساعت 5 PM هم عملا اجرا نشده (لاگ ندارد و Job زمان‌بندی‌شده برای `auto-clockout` دیده نشد)، پس Open Shiftهای قدیمی باقی مانده‌اند.

## برنامه اجرای اصلاح ریشه‌ای

### 1) اصلاح منطق Manual Clock Out (اصلی‌ترین fix)
فایل: `src/hooks/useTimeClock.ts`
- `clockOut` را از بستن «یک ردیف» به بستن «همه شیفت‌های باز همان پروفایل» تغییر می‌دهم:
  - شرط: `.eq("profile_id", myProfile.id).is("clock_out", null)`
  - `clock_out` یکسان با `new Date().toISOString()`
  - برای رکوردهای اضافی، note ثبت شود تا audit مشخص باشد.
- `activeEntry` را همیشه از جدیدترین شیفت باز انتخاب می‌کنم (مرتب‌سازی بر اساس `clock_in desc`) تا نمایش زمان و وضعیت deterministic شود.
- دکمه Clock In/Out را هنگام درخواست pending موقتاً disable می‌کنم تا دوبار کلیک همزمان race condition نسازد.

### 2) یکسان‌سازی رفتار در Face/Kiosk
فایل: `src/pages/TimeClock.tsx`
- در `handleConfirmPunch` وقتی قصد Clock Out دارد، مثل Manual Mode همه Open Shiftهای آن `profile_id` را می‌بندد (نه فقط اولین رکورد پیدا شده).
- در حالت Clock In هم قبل از insert، اگر Open Shift قدیمی وجود داشت، ابتدا بسته شود تا trigger خطا ندهد.
- نتیجه: چه دستی چه Face، رفتار یکسان و قابل اعتماد می‌شود.

### 3) پاکسازی داده‌های تاریخی خراب (یک‌بار برای همیشه)
عملیات دیتابیس (data operation):
- یک کوئری یک‌باره اجرا می‌کنم که برای هر پروفایل، اگر بیش از یک Open Shift دارد:
  - جدیدترین Open Shift را نگه دارد
  - بقیه Openها را با note مخصوص ببندد
- این کار باعث می‌شود کاربران فوراً از حلقه‌ی Clock Out گیر کرده خارج شوند و Team Status هم واقعی شود.

### 4) تثبیت Auto Clock-Out ساعت 5 PM برای rebar.shop (به جز Kourosh)
فایل: `supabase/functions/auto-clockout/index.ts` + تنظیم زمان‌بندی backend
- تابع را idempotent نگه می‌دارم: فقط رکوردهای `clock_out is null` را ببندد.
- فیلتر دامنه `@rebar.shop` با `lower(email)` و استثنا `kourosh@rebar.shop`.
- زمان Clock Out را دقیق 5 PM Eastern محاسبه و ثبت کند.
- Job زمان‌بندی واقعی برای روزهای کاری ایجاد/اصلاح می‌کنم و بعد با invocation تستی + لاگ صحت اجرا را تایید می‌کنم.

## جزئیات فنی (خلاصه)
- منبع اصلی باگ: ناسازگاری بین «مدل داده تاریخی (چند open)» و «کد بستن یک رکورد».
- اصل اصلاح: تمام مسیرهای punch باید atomic-ish و profile-based باشند، نه entry-based.
- بدون تغییر UI ساختاری؛ فقط منطق ثبت حضور/خروج و پایداری state اصلاح می‌شود.

## تست پذیرش (End-to-End)
1) کاربر Clock In بزند → رکورد جدید open ساخته شود → دکمه فوراً Clock Out شود.  
2) کاربر Clock Out بزند → هیچ open برای همان profile نماند → دکمه فوراً Clock In شود.  
3) سناریوی کاربر با چند Open Shift قدیمی → یک Clock Out همه را ببندد و UI درست برگردد.  
4) Face/Kiosk همین رفتار را تکرار کند.  
5) Auto 5 PM برای rebar.shop (به جز Kourosh) با لاگ و رکورد واقعی تایید شود.
