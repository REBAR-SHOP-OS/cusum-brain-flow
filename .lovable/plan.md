

## اعمال لوگوی رسمی شرکت در تصاویر Pixel — بدون هیچ تغییری

### وضعیت فعلی
- لوگوی فعلی (`public/brand/rebar-logo.png`) با لوگوی آپلود شده متفاوت است
- تابع `resolveLogoUrl` ابتدا در `knowledge` table جستجو می‌کند و سپس fallback به `social-images/brand/rebar-logo.png` دارد — این مسیر ناپایدار است
- prompt فعلی به مدل می‌گوید "Place the text REBAR.SHOP as a watermark" — یعنی مدل خودش لوگو می‌سازد به جای استفاده از لوگوی واقعی

### تغییرات

#### 1. کپی لوگوی جدید به پروژه
- فایل آپلود شده (`favicon-3.png`) به مسیر `public/brand/company-logo.png` کپی می‌شود
- این لوگوی طلایی-آبی سکه‌ای شکل، تنها لوگوی مجاز خواهد بود

#### 2. آپلود لوگو به Storage
- لوگو باید در باکت `social-images/brand/company-logo.png` هم موجود باشد تا edge function بتواند آن را به مدل AI ارسال کند
- یک اسکریپت ساده یا دستی این کار انجام می‌شود

#### 3. اصلاح `resolveLogoUrl` — مسیر مستقیم و قطعی
- فایل: `supabase/functions/ai-agent/index.ts`
- به جای جستجو در knowledge table، مستقیماً از مسیر ثابت Storage استفاده شود:
```
const logoUrl = `${supabaseUrl}/storage/v1/object/public/social-images/brand/company-logo.png`;
```
- این تضمین می‌کند که همیشه لوگوی صحیح استفاده شود

#### 4. اصلاح prompt تولید تصویر
- فایل: `supabase/functions/ai-agent/index.ts`
- prompt فعلی: "Place the text 'REBAR.SHOP' prominently as a watermark/logo"
- prompt جدید:
```
"MANDATORY: The attached company logo image MUST be placed EXACTLY as-is in the generated image, 
without ANY modification, distortion, or recreation. Place it in a visible corner as a watermark. 
Do NOT create or draw any other logo — ONLY use the provided logo image. 
Do NOT add text-based watermarks."
```
- همچنین دستور ارسال لوگو به مدل تقویت می‌شود تا مدل بداند لوگوی ارائه شده باید عیناً استفاده شود

#### 5. حذف وابستگی به knowledge table برای لوگو
- تابع `resolveLogoUrl` ساده‌سازی می‌شود — دیگر نیازی به جستجو در knowledge نیست
- فقط از مسیر ثابت Storage استفاده می‌کند

---

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `public/brand/company-logo.png` | کپی لوگوی جدید (سکه طلایی) |
| `supabase/functions/ai-agent/index.ts` | ساده‌سازی `resolveLogoUrl` + اصلاح prompt تولید تصویر |

### نکات فنی
- مدل‌های تولید تصویر (Gemini Flash/Pro) لوگو را به‌عنوان `image_url` دریافت می‌کنند و دستور صریح دارند که آن را بدون تغییر در تصویر قرار دهند
- هیچ لوگوی دیگری مجاز نیست — prompt صریحاً این را منع می‌کند
- fallback مسیر قدیمی (`rebar-logo.png`) حذف می‌شود تا تداخلی نباشد
