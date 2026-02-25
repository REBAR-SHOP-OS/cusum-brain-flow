
هدف فوری: مشکل Pixel را به‌صورت ریشه‌ای پایدار کنیم تا با زدن اسلات (۱ تا ۵ یا all) **همیشه ابتدا تصویر واقعی ساخته شود** و بعد کپشن بیاید، و لوگوی شرکت هم واقعاً وارد فرآیند تولید تصویر شود.

آنچه الان در کد و لاگ‌ها مشخص است:
1) مسیر deterministic برای Pixel Step 2 فعال است و در پاسخ موفق، markdown تصویر تولید می‌شود (`![...](...social-images...)`)، پس مسیر کلی درست است.
2) خطای کاربر (`Model returned no image`) از `generatePixelImage` می‌آید؛ یعنی پاسخ AI دریافت می‌شود ولی پارسر فعلی تصویر را پیدا نمی‌کند.
3) پارسر فعلی فقط `choices[0].message.images` را چک می‌کند، در حالی‌که در پروژه نمونه‌ی دیگر داریم که برای همین مدل گاهی خروجی در `message.parts[].inline_data.data` می‌آید.
4) Resolver لوگو در ai-agent با `title ilike '%logo%'` جستجو می‌کند، ولی رکورد فعلی social با عنوان `favicon` ذخیره شده؛ پس عملاً لوگو اکثر مواقع اصلاً attach نمی‌شود.
5) بعضی URLهای لوگو در Brain قدیمی/نامعتبر هستند (مثلاً لینک 404 یا signed URL منقضی‌شده) و باید از مسیر قابل‌اتکاتر resolve شوند.

برنامه اجرای اصلاح ریشه‌ای (بدون تغییر در رفتار سایر ایجنت‌ها):
1) یکپارچه‌سازی استخراج تصویر از پاسخ AI (robust parser)
- فایل: `supabase/functions/ai-agent/index.ts`
- helper استخراج تصویر اضافه می‌شود که این مسیرها را به‌ترتیب پشتیبانی کند:
  - `choices[0].message.images[0].image_url.url`
  - `choices[0].message.parts[*].inline_data.data` (تبدیل به data URL)
  - `choices[0].message.content[*].image_url.url` (اگر provider به این فرمت برگرداند)
- خروجی helper: `dataUrl | null` + metadata برای لاگ.
- نتیجه: حالت «مدل تصویر داده ولی کد نفهمیده» حذف می‌شود.

2) ایجاد pipeline تولید تصویر با Retry + Fallback مدل
- فایل: `supabase/functions/ai-agent/index.ts`
- به‌جای یک call تک‌مرحله‌ای:
  - Attempt 1: `google/gemini-2.5-flash-image` با لوگو
  - Attempt 2: همان مدل بدون لوگو (اگر لوگوی ورودی عامل fail باشد)
  - Attempt 3: `google/gemini-3-pro-image-preview` با لوگو
- اگر در هر Attempt تصویر استخراج شد → آپلود در `social-images` و return.
- فقط اگر همه شکست خوردند خطای فنی دقیق برگردد.
- نتیجه: پایداری بالا و حذف failureهای مقطعی.

3) اصلاح Resolver لوگو برای enforce واقعی
- فایل: `supabase/functions/ai-agent/index.ts`
- lookup لوگو برای social اصلاح می‌شود:
  - جستجو بر اساس `metadata.agent = 'social'` و `category = 'image'` با اولویت title شامل `logo` یا `favicon`
  - اگر `source_url` از `estimation-files` باشد، مسیر فایل استخراج و **signed URL تازه** از پروژه فعلی ساخته شود (نه اتکا به URL منقضی‌شده).
  - fallback نهایی: استفاده از مسیر ثابت برندیگ پروژه (`/brand/rebar-logo.png`) با مبنای origin درخواست.
- نتیجه: ورودی لوگو عملاً همیشه قابل resolve می‌شود.

4) enforce ترتیب خروجی: اول تصویر، بعد کپشن
- فایل: `supabase/functions/ai-agent/index.ts`
- در پاسخ deterministic:
  - خط اول markdown تصویر
  - سپس Caption/Hashtags/Contact
- در حالت failure کامل:
  - به‌جای نمایش کپشن بدون تصویر، خطای فنی واضح می‌دهد تا UI پاسخ اشتباه «پست بدون عکس» نداشته باشد.
- نتیجه: رفتار خروجی دقیقاً مطابق نیاز شما.

5) هم‌راستاسازی مسیر tool-call برای جلوگیری از Drift
- فایل: `supabase/functions/_shared/agentToolExecutor.ts`
- branch مربوط به `generate_image` به همان parser/retry/logo-resolver جدید همسان می‌شود.
- نتیجه: چه مسیر deterministic اجرا شود چه مسیر tool، خروجی یکسان و پایدار خواهد بود.

6) سخت‌گیری بیشتر روی قوانین Pixel (متن ساختگی ممنوع)
- فایل: `supabase/functions/_shared/agents/marketing.ts`
- rule صریح حفظ/تقویت می‌شود که placeholderهایی مثل `[Image of ...]` ممنوع است و فقط URL واقعی تصویر قابل قبول است.
- نتیجه: از بازگشت رفتار متنی جعلی جلوگیری می‌شود.

تست پذیرش (اجباری، end-to-end):
1) `/agent/social` → New chat → انتخاب `1`
- باید تصویر واقعی render شود (نه warning)، و زیر آن caption بیاید.
2) انتخاب زمان مثل `06:30` یا `2:30 PM`
- باید به اسلات درست map شود و تصویر بسازد.
3) انتخاب `all`
- باید ۵ تصویر واقعی پشت‌سرهم برگردد.
4) تأیید لوگو
- در لاگ/payload مشخص باشد لوگو resolve شده و در request مدل استفاده شده.
5) Regression
- agentهای غیر social هیچ تغییر رفتاری نداشته باشند.

ریسک‌ها و کنترل:
- ریسک: provider فرمت پاسخ را تغییر دهد → parser چندفرمته + fallback مدل.
- ریسک: URL لوگو نامعتبر/منقضی باشد → signed URL تازه + fallback مسیر ثابت برندیگ.
- ریسک: failure مقطعی شبکه/مدل → retry مرحله‌ای و پاسخ خطای شفاف.

فایل‌هایی که در اجرا تغییر می‌کنند:
- `supabase/functions/ai-agent/index.ts` (اصلاح اصلی)
- `supabase/functions/_shared/agentToolExecutor.ts` (همسان‌سازی ابزار)
- `supabase/functions/_shared/agents/marketing.ts` (تقویت قواعد رفتاری)
