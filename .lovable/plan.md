## هدف
روی کارت سوشال‌مدیا، اسم تک‌تک پیج‌ها همیشه دیده شود — پیج‌هایی که پست برایشان موفق publish شده **سبز** و پیج‌های ناموفق **قرمز** بمانند. نیازی به کلیک روی dropdown نباشد.

## محدوده
فقط UI کارت کلندر سوشال‌مدیا.

- فایل: `src/components/social/SocialCalendar.tsx`
- کامپوننت داخلی: `PageStatusDropdown` (داخل همین فایل)

## تغییرات

1. **حذف حالت collapse پیش‌فرض** در `PageStatusDropdown`:
   - لیست پیج‌ها همیشه render شود (بدون `useState(open)`).
   - عنوان `Pages (N)` و آیکن ChevronDown حذف یا به یک header ساده تبدیل شود.

2. **منطق رنگ هر پیج** (با استفاده از `parsePageStatuses` که از قبل وجود دارد و نیاز به تغییر ندارد):
   - `ps.failed === false` → اسم پیج با کلاس `text-green-500` + آیکن `CheckCircle2` سبز.
   - `ps.failed === true` → اسم پیج با کلاس `text-destructive` + آیکن `XCircle` قرمز.
   - رفتار `parsePageStatuses` فعلاً درست است:
     - status=`published` بدون خطا → همه سبز
     - status=`published` با partial → موفق‌ها سبز / نام‌برده‌شده‌های خطا قرمز
     - status=`failed` → همه قرمز
     - status=`publishing`/`scheduled`/`pending`/`draft` → همه قرمز (هنوز publish نشده)

3. **فشردگی بصری**: اگر تعداد پیج‌ها زیاد بود (>4)، فونت `text-[10px]` و فاصله `space-y-0.5` فعلی حفظ شود تا کارت زیادی بلند نشود.

## خارج از محدوده
- بدون تغییر دیتابیس.
- بدون تغییر edge function ها.
- بدون تغییر منطق publish.
- بدون تغییر سایر کارت‌ها/تب‌ها/UI ها.

## ریسک
هیچ — صرفاً UI presentational تغییر می‌کند.
