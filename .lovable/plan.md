

## الزام تولید محتوای غیرتکراری و درج جملات تبلیغاتی روی تصاویر

### مشکل فعلی
- تمام 5 اسلات (`PIXEL_SLOTS`) دارای `caption`، `hashtags`، `imagePrompt`، `imageTextFa` و `captionFa` **ثابت و هاردکد** هستند
- هر بار که اسلات 2 انتخاب شود، دقیقاً همان کپشن و prompt تکراری ارسال می‌شود
- در Regenerate فقط یک `variationSuffix` به imagePrompt اضافه می‌شود ولی کپشن همچنان تکراری است
- `imagePrompt` فعلی دستور صریحی برای نوشتن جمله تبلیغاتی روی عکس ندارد

### راه‌حل
تبدیل PIXEL_SLOTS از ساختار ثابت به **الگوی پایه (template)** و تولید پویای کپشن، هشتگ، و جمله تبلیغاتی روی عکس توسط LLM قبل از تولید تصویر.

---

### تغییرات فایل: `supabase/functions/ai-agent/index.ts`

#### 1. تغییر ساختار PIXEL_SLOTS به template
- فیلدهای `caption`, `hashtags`, `captionFa`, `imageTextFa` حذف می‌شوند
- فقط `slot`, `time`, `theme`, `product`, و یک `imageStyle` (توصیف سبک تصویر بدون جمله ثابت) باقی می‌ماند

#### 2. تابع جدید: `generateDynamicContent(slot, isRegenerate)`
- قبل از تولید تصویر، یک فراخوانی سریع به LLM (gemini-2.5-flash) انجام می‌شود با prompt مشخص:
  - یک **کپشن تبلیغاتی انگلیسی منحصربه‌فرد** بنویس برای محصول X با تم Y
  - یک **جمله کوتاه تبلیغاتی انگلیسی** (حداکثر 8 کلمه) برای نوشته شدن روی عکس بنویس
  - هشتگ‌های مرتبط بنویس
  - ترجمه فارسی کپشن و جمله روی عکس را بنویس
  - دستور صریح: **هرگز محتوای قبلی را تکرار نکن؛ هر بار محتوای کاملاً جدید و خلاقانه بساز**
- خروجی JSON ساختارمند: `{ caption, hashtags, imageText, imageTextFa, captionFa }`

#### 3. الزام درج جمله تبلیغاتی روی عکس
- `imagePrompt` نهایی شامل دستور صریح:
  ```
  MANDATORY: Write this exact advertising text prominently on the image in a clean,
  readable font: "[generated imageText]"
  ```
- این تضمین می‌کند هر عکس تولیدی حاوی جمله تبلیغاتی مرتبط با محصول باشد

#### 4. اعمال در هر دو مسیر (تولید اولیه و Regenerate)
- هم در تولید عادی اسلات و هم در Regenerate، ابتدا `generateDynamicContent` صدا زده می‌شود
- برای Regenerate، prompt شامل دستور اضافی: "این یک درخواست بازسازی است — محتوای کاملاً متفاوت از نسخه قبلی بساز"

#### 5. حفظ ساختار خروجی
- خروجی نهایی (reply) همچنان همان فرمت فعلی را دارد:
  - Slot #, Time, Product
  - تصویر
  - Caption + Hashtags + اطلاعات تماس
  - بخش PERSIAN (فقط اگر imageTextFa محتوا داشته باشد)

---

### جزئیات فنی

**ساختار جدید PIXEL_SLOTS:**

```text
slot: 1, time: "06:30 AM", theme: "Motivational / start of work day",
product: "Rebar Stirrups",
imageStyle: "Professional construction site at sunrise golden hour, steel rebar stirrups,
             workers, motivational atmosphere, photorealistic, 1:1 square"
```

**تابع generateDynamicContent (pseudo):**

```text
async function generateDynamicContent(slot, isRegenerate):
  prompt = "You are a creative advertising copywriter for a rebar/steel company.
            Product: {slot.product}, Theme: {slot.theme}
            RULES:
            - Write a UNIQUE, NEVER-BEFORE-SEEN caption (English)
            - Write a short ad slogan (max 8 words English) for the image
            - Write relevant hashtags
            - Translate caption and slogan to Farsi
            - NEVER repeat any previous content
            - If regenerate: make it COMPLETELY different
            Return JSON: {caption, hashtags, imageText, imageTextFa, captionFa}"

  call gemini-2.5-flash → parse JSON → return
```

**ساخت imagePrompt نهایی:**

```text
imagePrompt = slot.imageStyle +
  ". MANDATORY: Write this advertising text on the image in bold readable font: " +
  `"${dynamicContent.imageText}"` +
  " — variation timestamp: " + Date.now()
```

---

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `supabase/functions/ai-agent/index.ts` | تبدیل PIXEL_SLOTS به template + تابع generateDynamicContent + الزام جمله تبلیغاتی روی عکس + حذف تکرار |

### نتیجه
- هر بار تولید یا Regenerate → کپشن، هشتگ، و جمله روی عکس **کاملاً جدید و غیرتکراری**
- هر عکس **حتماً** شامل جمله تبلیغاتی مرتبط با محصول
- لوگوی شرکت همچنان الزامی
- ساختار خروجی و ترجمه فارسی حفظ می‌شود
