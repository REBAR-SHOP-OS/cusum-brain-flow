

# حذف هرگونه اشاره به ساعت در کپشن‌های Pixel Agent

## مشکل
با وجود دستور "NEVER mention any posting time" در پرامپت، هنوز AI ساعت‌ها را در کپشن‌ها ذکر می‌کند (مثلاً "At 7:30 AM, as the construction site awakens..."). دلیل: فیلد `time` در تعریف اسلات‌ها و تم‌هایی مانند "start of work day" به AI القا می‌کند.

## تغییرات — فایل: `supabase/functions/ai-agent/index.ts`

### ۱. حذف فیلد `time` از `PIXEL_SLOTS` (خطوط ۴۰-۶۰)
فیلد `time` از تمام اسلات‌ها حذف شود — فقط `slot`, `theme`, `product`, `imageStyles` باقی بمانند.

### ۲. تقویت دستور در پرامپت `generateDynamicContent` (خط ۱۱۴)
دستور فعلی:
```
- NEVER mention any posting time, schedule time, or clock time in the caption or slogan
```
تقویت شود به:
```
- ABSOLUTELY FORBIDDEN: Do NOT mention ANY time of day, hour, clock time, AM/PM, morning, afternoon, evening, dawn, sunrise, sunset, or any time-related phrases in the caption, slogan, or translations. This is a STRICT RULE with ZERO exceptions.
```

### ۳. حذف ساعت از جدول Schedule Reply (خطوط ۵۰۳-۵۱۳)
ستون "Time (EST)" از جدول حذف شود — فقط شماره اسلات، تم و محصول نمایش داده شود.

### ۴. حذف `TIME_TO_SLOT` mapping (خطوط ۵۳۴-۵۴۰)
دیگر نیازی به تبدیل ساعت به اسلات نیست.

### ۵. تم "start of work day" → "Motivational / Strength" (خط ۴۲)
تم‌هایی که اشاره‌ی ضمنی به ساعت دارند اصلاح شوند.

