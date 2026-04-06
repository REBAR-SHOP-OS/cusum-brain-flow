

# Vizzy Brain — اطمینان از ذخیره اطلاعات Time Clock

## وضعیت فعلی
- داده‌های Time Clock **در context AI وجود دارند** (از `vizzyFullContext.ts` — شامل clock-in/out، ساعات کار، حضور و غیاب)
- پرامپت `analyzeSystem` بخش `[TIME CLOCK]` را درخواست می‌کند
- اما AI ممکن است این بخش را خلاصه یا خالی رد کند و نتیجه: `(0)` در Brain

## مشکل اصلی
پرامپت فعلی کافی نیست — AI باید **مجبور** شود اطلاعات دقیق timeclock را گزارش دهد. همچنین pre-digest هم این داده‌ها را با category `daily_benchmark` ذخیره می‌کند (نه `timeclock`).

## تغییرات

### 1. فایل: `src/hooks/useVizzyMemory.ts`

پرامپت `[TIME CLOCK]` را تقویت می‌کنم تا AI مجبور باشد اطلاعات دقیق بدهد:

```
[TIME CLOCK]: 
- List EVERY employee and their status (clocked in / not clocked in)
- For clocked-in: name, clock-in time, hours worked so far
- For clocked-out: name, clock-in time, clock-out time, total hours
- For not clocked in: name, mark as "Not clocked in"
- Total staff on site, total hours across team
- Any anomalies: missed punches, overtime (>8h), late arrivals
- THIS SECTION IS MANDATORY — do NOT skip even if data seems simple
```

### 2. فایل: `supabase/functions/vizzy-pre-digest/index.ts`

در pre-digest، یک ذخیره‌سازی جداگانه با category `timeclock` اضافه می‌شود تا هر روز خلاصه Time Clock مستقیماً در Brain قابل مشاهده باشد. از بخش "PER-PERSON INTELLIGENCE" خروجی AI، اطلاعات ساعت کاری استخراج و با category `timeclock` ذخیره می‌شود.

### نتیجه
- "Analyze Now" همیشه اطلاعات کامل timeclock تولید و ذخیره می‌کند
- Pre-digest هم روزانه خلاصه timeclock را جداگانه ذخیره می‌کند
- بخش ⏰ Time Clock در Brain دیگر خالی نمی‌ماند

