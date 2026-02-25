
## رفع خطای "Failed to send a request to the Edge Function" در ایجنت Pixel

### ریشه مشکل
دو مشکل هم‌زمان وجود دارد:

**مشکل ۱: هدرهای CORS ناقص**
فایل `supabase/functions/ai-agent/index.ts` خط ۲۰ فقط شامل `authorization, x-client-info, apikey, content-type` است، اما مرورگر هدرهای اضافی `x-supabase-client-platform` و مشابه آن را هم ارسال می‌کند. این باعث بلاک شدن درخواست توسط مرورگر می‌شود.

**مشکل ۲: مدل ابزار generate_image را صدا نمی‌زند**
وقتی کاربر "1" را می‌فرستد، مدل Gemini به جای فراخوانی `generate_image` پاسخ متنی بی‌ربط برمی‌گرداند. تست مستقیم edge function هم همین مشکل را نشان داد — مدل گفت "Please provide more details" به جای فراخوانی ابزار.

### راه‌حل

#### A) اصلاح CORS (فایل: `supabase/functions/ai-agent/index.ts`)
هدرهای CORS کامل جایگزین شوند:
```text
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"
```

#### B) Deterministic Guardrail برای تولید تصویر (فایل: `supabase/functions/ai-agent/index.ts`)
مشابه guardrail مرحله ۱ (نمایش schedule)، وقتی کاربر یک عدد (1-5) یا "all" ارسال کند، سیستم بدون وابستگی به LLM:
1. شماره اسلات و موضوع را تشخیص دهد
2. یک prompt مناسب برای تولید تصویر بسازد
3. مستقیم `generate_image` tool را اجرا کند (بدون اینکه LLM تصمیم بگیرد)
4. تصویر تولیدشده + کپشن + هشتگ + اطلاعات تماس را برگرداند

منطق تشخیص:
- ورودی "1" تا "5" → اسلات مشخص
- ورودی "all" → تولید تمام ۵ اسلات
- فقط برای agent === "social" فعال است

#### C) ساخت prompt تصویر هوشمند
برای هر اسلات یک prompt حرفه‌ای تصویری از پیش تعریف‌شده ساخته می‌شود:
- اسلات ۱ (06:30): صحنه صبحگاهی ساختمانی + Rebar Stirrups + پیام انگیزشی
- اسلات ۲ (07:30): تبلیغات خلاقانه + Rebar Cages
- اسلات ۳ (08:00): استحکام + Fiberglass Rebar (GFRP)
- اسلات ۴ (12:30): نوآوری + Wire Mesh
- اسلات ۵ (14:30): محصول تبلیغاتی + Rebar Dowels

#### D) پس از تولید تصویر
بعد از دریافت URL تصویر، یک پیام کامل شامل:
- لینک تصویر (قابل نمایش در چت)
- کپشن انگلیسی مرتبط با موضوع
- اطلاعات تماس شرکت
- هشتگ‌های مرتبط

این پاسخ مستقیم ساخته می‌شود و نیازی به LLM ندارد.

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `supabase/functions/ai-agent/index.ts` | اصلاح CORS + افزودن guardrail تولید تصویر |

### نتیجه
بعد از این تغییر، وقتی کاربر عدد ۱ تا ۵ یا "all" بزند، تصویر بدون هیچ خطایی و بدون وابستگی به تصمیم LLM تولید می‌شود.
