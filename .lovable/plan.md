
مشکل را ریشه‌ای بررسی کردم. ایراد از UI نیست؛ `VizzyBrainPanel` گروه `Time Clock` را درست نشان می‌دهد و فقط چون هیچ رکوردی با category=`timeclock` وارد `vizzy_memory` نشده، بخش خالی می‌ماند.

## مشکل اصلی

دو مسیر فعلی برای پر کردن Time Clock قابل اتکا نیستند:

1. `src/hooks/useVizzyMemory.ts`
   - دکمه Analyze Now به agent=`assistant` می‌رود.
   - این agent context اختصاصی و کامل time clock مثل `buildFullVizzyContext` ندارد.
   - در نتیجه حتی با prompt قوی، ممکن است خروجی `[TIME CLOCK]` ناقص یا خالی باشد.

2. `supabase/functions/vizzy-pre-digest/index.ts`
   - الان time clock را از متن آزاد AI با regex استخراج می‌کند:
   - دنبال `PER-PERSON INTELLIGENCE` می‌گردد و فقط lineهایی که شامل `clock|hour|shift|absent` باشند ذخیره می‌کند.
   - این روش شکننده است؛ اگر AI تیتر را عوض کند یا متن را متفاوت بنویسد، هیچ رکوردی ذخیره نمی‌شود.
   - یعنی داده واقعی در context هست، اما persistence وابسته به فرمت متن AI شده است.

## راه‌حل ریشه‌ای

### 1) ذخیره deterministic برای Time Clock در `vizzy-pre-digest`
فایل: `supabase/functions/vizzy-pre-digest/index.ts`

به‌جای استخراج از متن AI:
- همان‌جا از دیتابیس `time_clock_entries` + `profiles` برای امروز بخوانیم
- برای هر کارمند، رکورد timeclock واقعی بسازیم و مستقیم در `vizzy_memory` با category=`timeclock` ذخیره کنیم
- موارد زیر حتماً تولید شوند:
  - هر کارمند: clocked in / clocked out / not clocked in today
  - ساعت ورود
  - ساعت خروج اگر وجود دارد
  - مجموع ساعات امروز
  - total staff on site
  - total team hours today
  - anomalyها مثل overtime و late arrival

این بخش باید کاملاً database-driven باشد، نه AI-driven.

### 2) حذف وابستگی regex به متن AI برای Time Clock
فایل: `supabase/functions/vizzy-pre-digest/index.ts`

بخش فعلی:
- `fullDigest.match(...)`
- `tcSection.split("\n")`
- فیلتر با regex روی متن

باید برای Time Clock کنار گذاشته شود یا فقط fallback ثانویه بماند.
منبع اصلی ذخیره Time Clock باید داده واقعی جدول باشد.

### 3) Analyze Now هم از context درست تغذیه شود
فایل: `src/hooks/useVizzyMemory.ts`

به‌جای اتکا به agent assistant برای ساخت facts:
- یا از edge function اختصاصی مبتنی بر `buildFullVizzyContext` استفاده شود
- یا Analyze Now برای بخش time clock مستقیماً از backend snapshot استفاده کند

بهترین مسیر کم‌ریسک:
- یک endpoint تحلیلی موجود/جدید که context کامل Vizzy را می‌سازد
- سپس AI فقط summary بدهد
- اما ذخیره category=`timeclock` همچنان از facts واقعی انجام شود

یعنی:
- AI برای wording
- دیتابیس برای truth

### 4) ثبت تاریخ گزارش به‌صورت واضح
فایل‌ها:
- `supabase/functions/vizzy-pre-digest/index.ts`
- `src/components/vizzy/VizzyBrainPanel.tsx`

برای هر memory مربوط به timeclock:
- `metadata.report_date`
- `metadata.report_timezone`
- `metadata.source = "timeclock_daily_snapshot"`

و در UI:
- اگر metadata گزارش موجود بود، بالای کارت/گروه تاریخ گزارش نمایش داده شود
- به‌جای اینکه کاربر فقط `created_at` ببیند، `Report Date: Apr 6, 2026` هم ببیند

### 5) dedupe روزانه برای Time Clock
فایل: `supabase/functions/vizzy-pre-digest/index.ts`

برای جلوگیری از انباشت و تکرار:
- قبل از insert، رکوردهای timeclock همان روز/همان کاربر/همان company را با metadata.report_date بررسی کنیم
- یا محتوای همان روز replace/update شود
- یا فقط snapshotهای جدید با marker مشخص ذخیره شوند

هدف:
- هر روز یک snapshot تمیز و قابل‌فهم
- نه چندین خط تکراری از یک روز

## تغییرات پیشنهادی دقیق

### فایل `supabase/functions/vizzy-pre-digest/index.ts`
- اضافه کردن helper برای ساخت daily timeclock snapshot از جدول‌های واقعی
- query کردن:
  - `profiles`
  - `time_clock_entries` برای امروز
- ساخت lineهای قطعی برای هر نفر
- ذخیره در `vizzy_memory` با category=`timeclock`
- ثبت metadata شامل تاریخ گزارش
- حذف/کاهش وابستگی به parsing متن AI

### فایل `src/hooks/useVizzyMemory.ts`
- Analyze Now را طوری اصلاح می‌کنم که:
  - اگر AI بخش time clock نداد، backend facts باز هم ذخیره شوند
  - category timeclock فقط بر اساس متن AI تولید نشود
- در عمل Time Clock حتی اگر AI بد فرمت بدهد، خالی نمی‌ماند

### فایل `src/components/vizzy/VizzyBrainPanel.tsx`
- نمایش تاریخ گزارش از `metadata.report_date`
- اگر چند snapshot روزانه باشد، گروه‌بندی با report date به‌جای صرفاً `created_at` برای timeclock بهتر می‌شود

## نتیجه بعد از اجرا

- بخش `Time Clock` هر روز به‌صورت واقعی پر می‌شود
- Vizzy تمام وضعیت حضور روزانه را می‌داند
- خالی بودن این بخش دیگر به فرمت پاسخ AI وابسته نیست
- کاربر دقیقاً می‌فهمد گزارش مربوط به چه روزی است
- سیستم از حالت شکننده به حالت قابل اعتماد و دیتابیس‌محور تبدیل می‌شود

## نکته فنی مهم
مسئله واقعی این است:
```text
الان "واقعیت" time clock در دیتابیس وجود دارد،
اما "ذخیره در Brain" به parsing متن AI وابسته شده.
ریشه مشکل همین coupling است.
```

اصلاح ریشه‌ای:
```text
DB facts -> deterministic timeclock memories
AI summary -> optional enrichment
UI -> render by category + report date
```
