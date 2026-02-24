

### هدف
دو مشکل همزمان باید حل شود، با رعایت قانون شما که تغییرات فقط در بخش‌های مشخص‌شده انجام شود:

1) **Build/Publish الان fail می‌شود** چون سیستم مهاجرت دیتابیس تلاش می‌کند `vector` extension را Drop کند و به‌خاطر وابستگی‌های `document_embeddings` و `match_documents` خطا می‌گیرد.  
2) **اسکرین‌شات روی مسیر /website و بعضی صفحات** به خطا می‌خورد (طبق اسکرین‌شات: `Failed to capture screen on /website`) و باید برای همه کاربران با دامنه `@rebar.shop` در تمام اپ کار کند.

---

## بخش A) رفع خطای Build (فقط در مهاجرت‌های دیتابیس)

### وضعیت فعلی (ریشه مشکل)
در `supabase/migrations/20260220145815_9de6871d-260c-4c3a-b02c-22328f9dd204.sql` یک مهاجرت وجود دارد که شامل این دستور است:
- `DROP EXTENSION IF EXISTS vector ...`

این باعث می‌شود در مرحله Diff/Apply، سیستم قبل از اینکه وابستگی‌ها را درست حذف کند، به Drop extension گیر کند و کل Build/Publish متوقف شود.

### تغییرات پیشنهادی (حداقل و امن)
**فایل هدف:**  
- `supabase/migrations/20260220145815_9de6871d-260c-4c3a-b02c-22328f9dd204.sql`

**کار:**
- تمام بخش‌های destructive داخل این migration که `DROP EXTENSION vector` (و drop table/function) دارند حذف/خنثی شوند.
- این migration به یک مهاجرت “ایمن” تبدیل شود که فقط مطمئن می‌شود extension وجود دارد:

```sql
-- Keep vector enabled; avoid destructive drop/recreate steps
CREATE EXTENSION IF NOT EXISTS vector;
```

### نتیجه
- Build/Publish دیگر به خاطر Drop extension گیر نمی‌کند.
- هیچ دیتایی حذف نمی‌شود.
- هیچ تغییری در سایر جداول/پالیسی‌ها/منطق اپلیکیشن انجام نمی‌شود.

---

## بخش B) رفع قطعی خطای Screenshot در کل اپ (فقط در کامپوننت Screenshot)

### وضعیت فعلی (ریشه مشکل)
در `src/components/feedback/ScreenshotFeedbackButton.tsx`:
- Retry “بدون تصویر” فقط در حد پیام لاگ است؛ ولی عملاً `skipImages` در تنظیمات `html2canvas` اعمال نمی‌شود.
- در مسیر `/website` یک iframe خارجی (`rebar.shop`) وجود دارد؛ html2canvas معمولاً با **iframe و منابع cross-origin** مشکل دارد و می‌تواند کل capture را fail کند.

### تغییرات پیشنهادی
**فایل هدف:**  
- `src/components/feedback/ScreenshotFeedbackButton.tsx`

**کارهای دقیق:**

1) **حذف عامل اصلی خطا: iframe**
   - در `ignoreElements` از ابتدا، همه `iframe`, `embed`, `object` را ignore کنیم (برای جلوگیری از crash/taint).
   - این باعث می‌شود حتی اگر محتوای iframe قابل کپچر نباشد، خود اسکرین‌شات از UI اپ گرفته شود و ابزار fail نکند.

2) **واقعی کردن Retry “بدون تصاویر”**
   - `captureOnce(skipImages)` باید واقعاً وقتی `skipImages=true` است این موارد را ignore کند:
     - `img`, `video`, `picture`, `source`, `svg`, `canvas` (به‌عنوان fallback برای صفحاتی که منابع CORS ندارند)

3) **پاکسازی DOM clone برای ثبات بیشتر**
   - در `onclone` علاوه بر خاموش‌کردن animation/transition:
     - iframeها را از DOM clone حذف/replace کنیم تا html2canvas وارد clone iframe نشود.
     - در حالت `skipImages=true` تصاویر را هم remove/replace کنیم.

4) **بهبود پایداری تایم‌اوت**
   - تایم‌اوت capture را کمی افزایش دهیم (مثلاً برای صفحات غیر-heavy از 5s به 8s) تا روی صفحات سنگین کمتر fail شود.
   - Heavy-page logic فعلی حفظ می‌شود.

### نتیجه
- کلیک روی آیکون اسکرین‌شات در `/website` دیگر ارور نمی‌دهد و overlay باز می‌شود.
- روی سایر صفحات هم اگر به دلیل CORS تصاویر fail شوند، Retry واقعاً بدون تصاویر انجام می‌شود و capture موفق می‌شود.
- این تغییر فقط در همین کامپوننت انجام می‌شود و روی سایر بخش‌ها/ایجنت‌ها اثری ندارد.

---

## تست‌های لازم (حتماً End-to-End)
1) با یک یوزر `@rebar.shop`:
   - روی چند صفحه داخلی اپ اسکرین‌شات بگیرید → باید overlay باز شود.
2) روی مسیر `/website`:
   - اسکرین‌شات بگیرید → باید overlay باز شود (حتی اگر محتوای iframe در تصویر نیاید).
3) یک صفحه سنگین (لیست/کانبان/جدول):
   - اسکرین‌شات بگیرید → اگر تلاش اول fail شد، تلاش دوم باید موفق شود.

---

## محدوده تغییرات (مطابق قانون شما)
فقط این دو فایل تغییر می‌کنند و هیچ جای دیگری دست نمی‌خورد:
- `supabase/migrations/20260220145815_9de6871d-260c-4c3a-b02c-22328f9dd204.sql`
- `src/components/feedback/ScreenshotFeedbackButton.tsx`

