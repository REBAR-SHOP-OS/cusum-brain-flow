

# افزودن بخش آپلود لوگو به Pixel Brain و رفع خطای لوگو

## تغییرات

### ۱. فایل: `src/components/social/PixelBrainDialog.tsx`

یک بخش جدید **Logo** به بالای دیالوگ اضافه شود (قبل از Custom Instructions):
- آیکون `Image` با عنوان "Logo"
- اگر لوگو در `social-images/brand/company-logo.png` موجود باشد → پیش‌نمایش تصویر نشان دهد
- دکمه آپلود (input file) برای انتخاب فایل PNG/JPG
- آپلود مستقیم به `social-images/brand/company-logo.png` در storage (upsert)
- پس از آپلود موفق → toast success و رفرش پیش‌نمایش

### ۲. فایل: `supabase/functions/ai-agent/index.ts`

خطای بلاک‌کننده را به **هشدار** تبدیل کن — اگر لوگو پیدا نشد، تصویر بدون لوگو تولید شود (به جای بلاک کامل):
- خط ۲۴۵-۲۵۲: به جای return error، فقط `logoUrl = null` بماند و ادامه دهد
- خط ۵۴۸-۵۵۸: حذف بلاک و اجازه ادامه بدون لوگو
- لاگ warning بماند ولی تولید تصویر متوقف نشود

## فایل‌های تغییر
1. `src/components/social/PixelBrainDialog.tsx` — بخش آپلود لوگو
2. `supabase/functions/ai-agent/index.ts` — تبدیل خطای لوگو به هشدار (soft-fail)

