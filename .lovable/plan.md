
کاربر یک متن فارسی «ذخیره» در toolbar editor دیده (دایره قرمز در تصویر) و طبق memory rule (`mem://style/language-standard`) تمام UI باید انگلیسی باشد.

## بررسی

نیاز است تمام رشته‌های فارسی در UI کامپوننت‌های ad-director / video editor جستجو و به انگلیسی تبدیل شوند. به‌ویژه «ذخیره» در toolbar که در تصویر مشخص است.

## برنامه

### مرحله ۱: شناسایی
جستجوی regex برای کاراکترهای فارسی در فایل‌های UI:
- `src/components/ad-director/**`
- `src/components/social/**`
- `src/pages/AdDirector.tsx`, `src/pages/VideoStudio.tsx`

### مرحله ۲: ترجمه
ترجمه‌های استاندارد:
- `ذخیره` → `Save`
- `دانلود` → `Download`
- `بازگشت` → `Back`
- `حذف` → `Delete`
- `ویرایش` → `Edit`
- `موسیقی خودکار` → `Auto Music`
- و سایر رشته‌های یافت‌شده

### مرحله ۳: استثنا
طبق memory rule، Persian فقط در دو مورد مجاز است:
- Vizzy Voice Chat
- Captions/subtitles محتوا

→ این موارد دست‌نخورده می‌مانند.

### آنچه دست‌نخورده می‌ماند
- منطق، state، API
- Voice chat و captions
- DB / RLS / edge functions

## نتیجه
1. ✅ تمام label/button/tooltip در UI ad-director انگلیسی
2. ✅ "ذخیره" → "Save" در toolbar
3. ✅ Memory rule زبان رعایت می‌شود
