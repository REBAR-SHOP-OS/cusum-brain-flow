

# آپدیت PDF معماری REBAR SHOP OS

## هدف
PDF فعلی (نسخه آوریل ۲۰۲۶ — ۷ لایه، ۷۷ کامپوننت، ۹۳ کانکشن) را با وضعیت **واقعی امروز** پروژه به‌روزرسانی کرده و یک فایل PDF جدید برای دانلود بدهم.

## چه چیزهایی در PDF فعلی قدیمی شده‌اند

پس از مقایسه با کدبیس فعلی، این بخش‌ها نیاز به آپدیت دارند:

### ۱) آمار سربرگ
- **AI / Automation Agents**: قبلاً ۱۱ → الان دقیق‌تر (Vizzy، Nila، Blitz، Accounting، Estimating، Shopfloor، Support، Feedback، SEO Copilot، Social Cron، App-Help)
- **Edge Functions**: عدد ۱۲ خیلی پایین است؛ پروژه الان ده‌ها edge function دارد
- **Cron Jobs**: اضافه شدن آمار «۲۳ cron فعال، ~۳,۰۰۰ اجرا/روز»

### ۲) لایه AI / Automation
- اضافه کردن **مدل‌های واقعی**: `gemini-2.5-flash` (Vizzy)، `gemini-2.5-pro` (Accounting/Estimating)، `gpt-4o-mini` (App-Help)، OpenAI Realtime (Voice)
- اضافه کردن **Vizzy Voice** (`/vizzy-live`) جدا از Vizzy متنی
- اضافه کردن **Business Watchdog** و **Daily Brief** و **Pre-Digest**
- اضافه کردن **soft-error pattern** (402/429) برای Ad Director

### ۳) لایه Integrations
- اضافه کردن: **Plaid (BMO observer, read-only)**, **DashScope/Wan 2.6 (video)**, **Synology FileStation proxy**, **ElevenLabs TTS**
- اضافه کردن **Lovable Cloud / Supabase Edge** به‌عنوان runtime

### ۴) لایه Business Modules
- اضافه کردن: **Ad Director** (مستقل از Video)، **Order Calculator**، **Tasks** (با delegate access)، **Logistics & Delivery**

### ۵) لایه Security
- اضافه کردن: **JWT local validation**، **search_path hardening**، **security_invoker views**، **CEO SMS throttling**، **auth signup lockdown trigger**

### ۶) بخش جدید: Cost & Usage Profile
بر اساس داده‌های واقعی ۳۰ روز گذشته:
- توکن‌های AI به تفکیک agent (Vizzy ~۸۰٪)
- فراوانی cron‌ها
- جداول bloated دیتابیس
- بهینه‌سازی‌های پیشنهادی

### ۷) Workflow State Machine
- اضافه کردن flow تولید: `cutting → clearance → complete`
- اضافه کردن workflow hard gates (quote_sent ↔ customer_id)

## محدوده تغییر
- فقط تولید **یک PDF جدید** در `/mnt/documents/REBAR_SHOP_OS_Architecture_v2.pdf`
- بدون تغییر هیچ فایل کد پروژه
- بدون تغییر دیتابیس، RLS، edge functions
- ساختار ۷ لایه و ۱۲ صفحه‌ای حفظ می‌شود — فقط محتوا و آمار به‌روز می‌شود

## روش اجرا
1. اسکریپت Python با `reportlab` بنویسم در `/tmp/build_arch_pdf.py`
2. ساختار قدیم را به‌عنوان template بازسازی کنم با محتوای جدید
3. فونت helvetica + رنگ accent برای هر لایه (مطابق نسخه قبلی)
4. بعد از تولید، `pdftoppm` بزنم و **همه صفحات را visual QA** کنم (طبق skill mandate)
5. اگر کلیپ یا overlap بود، fix کنم و دوباره render
6. فایل نهایی را به‌عنوان `<lov-artifact>` به شما تحویل بدهم

## خروجی نهایی
- فایل: `REBAR_SHOP_OS_Architecture_v2.pdf` (۱۲–۱۴ صفحه)
- Artifact tag برای دانلود مستقیم
- خلاصه‌ای از تغییرات اعمال‌شده

## اعتبارسنجی
- همه صفحات بدون text clipping
- جداول صحیح render شده
- آمار دقیق و مطابق وضعیت فعلی پروژه
- هیچ Unicode subscript/superscript استفاده نشود (طبق skill rule)

