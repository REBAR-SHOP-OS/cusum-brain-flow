
## رفع ریشه‌ای مشکل Pixel Agent

### نتیجه بررسی
مشکل از خود پرامپت یا مدل نیست؛ یک باگ کدنویسی در مسیر اصلی تولید تصویر Pixel وجود دارد.

**شواهد**
- درخواست واقعی کاربر به `ai-agent` با این کانتکست ارسال شده:
  - `agent: "social"`
  - `message: "یک عکس بساز برای نوروز"`
  - `context.imageAspectRatio: "1:1"`
- پاسخ تابع هم دقیقاً همین خطا را برگردانده:
  - `"aspectRatio is not defined"`

### ریشه اصلی باگ
در فایل:

`supabase/functions/_shared/agentToolExecutor.ts`

داخل شاخه `generate_image`، متغیر `aspectRatio` **داخل بلاک**
```ts
if (agent === "social") { ... }
```
تعریف شده، اما چند خط بعد **خارج از آن بلاک** استفاده می‌شود:
- برای `openaiSizeMap[aspectRatio]`
- برای `cropToAspectRatio(imageBytes, aspectRatio)`
- برای fallbackهای بعدی

یعنی وقتی ابزار `generate_image` اجرا می‌شود، در زمان استفاده از آن متغیر، اسکوپش از بین رفته و همان خطای `aspectRatio is not defined` تولید می‌شود.

### باگ دوم که همزمان باید اصلاح شود
در فایل:

`supabase/functions/ai-agent/index.ts`

در بخش `socialStyleOverride` این خط وجود دارد:
```ts
const aspectRatio = (context?.imageAspectRatio as string) || "1:1";
```

اما در این محدوده اصلاً `context` تعریف نشده و باید از `mergedContext` یا `userContext` استفاده شود.  
یعنی حتی اگر باگ اول رفع شود، وقتی کاربر از تولبار Style/Product استفاده کند، یک خطای ثانویه در همین قسمت رخ می‌دهد.

---

## پلن اجرا

### 1) اصلاح اسکوپ `aspectRatio` در مسیر اصلی تولید تصویر Pixel
**فایل:** `supabase/functions/_shared/agentToolExecutor.ts`

- `aspectRatio` را یک‌بار در ابتدای شاخه `generate_image` تعریف می‌کنم، قبل از `if (agent === "social")`
- بعد همان متغیر واحد را در تمام مسیرها استفاده می‌کنم:
  - composition hint
  - OpenAI size mapping
  - crop/resize
  - square fallback

**هدف:** متغیر در کل lifecycle تولید تصویر در دسترس باشد و دیگر ReferenceError رخ ندهد.

### 2) اصلاح منبع aspect ratio در prompt override
**فایل:** `supabase/functions/ai-agent/index.ts`

- این بخش را از:
```ts
(context?.imageAspectRatio as string)
```
به منبع درست تغییر می‌دهم:
```ts
(mergedContext?.imageAspectRatio as string)
```
یا در همان ساختار موجود به `userContext/mergedContext` که واقعاً در اسکوپ هست.

**هدف:** وقتی کاربر از چیپ‌های toolbar مثل Style / Product / Size استفاده می‌کند، Pixel باز هم پایدار بماند.

### 3) یکپارچه‌سازی منطق aspect ratio
برای جلوگیری از تکرار باگ:
- در هر دو مسیر Pixel (`ai-agent` و `agentToolExecutor`) نسبت تصویر از یک منبع ثابت گرفته می‌شود:
  1. `context.imageAspectRatio`
  2. اگر نبود، مقدار پیش‌فرض `1:1`

**هدف:** دیگر جایی از سیستم روی متغیر محلی ناپایدار تکیه نکند.

### 4) حفظ رفتار فعلی بدون تغییر در UX
هیچ تغییری در تجربه کاربر لازم نیست:
- همان چت Pixel
- همان selector نسبت تصویر
- همان مدل‌های فعلی
- همان Brain context و resource imageها

فقط مسیر اجرا پایدار می‌شود تا کاربر بتواند واقعاً عکس بگیرد.

---

## فایل‌هایی که باید تغییر کنند
1. `supabase/functions/_shared/agentToolExecutor.ts`
2. `supabase/functions/ai-agent/index.ts`

---

## جزئیات فنی
- **Bug 1:** block scope leak برای `aspectRatio`
- **Bug 2:** استفاده از `context` تعریف‌نشده در `ai-agent`
- **نیازی به تغییر دیتابیس نیست**
- **نیازی به تغییر فرانت‌اند نیست**
- تمرکز فقط روی منطق backend functionها است چون خطا در همان لایه تولید می‌شود

---

## نتیجه مورد انتظار بعد از پیاده‌سازی
بعد از این اصلاح:
- پیام‌هایی مثل `یک عکس بساز برای نوروز` باید واقعاً تصویر تولید کنند
- انتخاب نسبت تصویر `1:1 / 16:9 / 9:16` پایدار بماند
- استفاده از Style/Product chips هم باعث شکست مسیر نشود
- خطای `"aspectRatio is not defined"` به‌صورت ریشه‌ای حذف شود
