
## چرا این ارور می‌آید

با کلیک روی **AI Prompt**، کامپوننت `ChatPromptBar` اکشن `write-script` را به فانکشن `ad-director-ai` می‌فرستد.

بر اساس لاگ شبکه، درخواست واقعا با این پاسخ برمی‌گردد:
- HTTP status: `402`
- body: `{"ok":false,"error":"AI credits exhausted."}`

پس علت اصلی این است:
1. این دکمه برای ساخت پرامپت از AI استفاده می‌کند.
2. موجودی AI ورک‌اسپیس تمام شده است.
3. فانکشن بک‌اند درست همین خطا را برمی‌گرداند.
4. علاوه بر toast قرمز، محیط preview همین `402` را به‌عنوان `RUNTIME_ERROR` هم نشان می‌دهد و کارت سیاه خطا را باز می‌کند.

یعنی:
- **خطای واقعی کسب‌وکاری**: اعتبار AI تمام شده.
- **باگ UX/handling**: این خطای recoverable نباید صفحه را شبیه crash نشان بدهد.

## چیزی که باید اصلاح شود

### 1) `supabase/functions/ad-director-ai/index.ts`
برای خطاهای recoverable مثل:
- `402` AI credits exhausted
- `429` rate limit

به‌جای اینکه پاسخ HTTP خطادار برگردد، خروجی کنترل‌شده برگرداند مثل:
```json
{ "ok": false, "error": "AI credits exhausted.", "status": 402 }
```
تا preview آن را crash حساب نکند.

### 2) `src/lib/invokeEdgeFunction.ts`
منطق parsing طوری سفت‌تر شود که اگر پاسخ `200` بود ولی payload شامل:
- `ok: false`
- `error`
- `status`

بود، وضعیت خطا را حفظ کند و برای callerها قابل تشخیص بماند.  
این کار باعث می‌شود همه مسیرها رفتار یکسان داشته باشند، چه `allowErrorResponse` فعال باشد چه نباشد.

### 3) `src/components/ad-director/ChatPromptBar.tsx`
مسیر **AI Prompt** همین payload کنترل‌شده را بخواند و فقط:
- toast مناسب نشان بدهد
- dialog را ببندد
- loading state را reset کند
- هیچ blank screen یا overlay نسازد

این فایل الان تا حد زیادی درست هندل می‌کند، ولی بعد از تغییر پاسخ بک‌اند باید با payload جدید نهایی sync شود.

### 4) بررسی مسیرهای مشابه
چون همین فانکشن `ad-director-ai` در چند جای دیگر هم استفاده شده، این دو مصرف‌کننده هم باید با همان الگوی recoverable سازگار بمانند:
- `src/components/ad-director/CharacterPromptDialog.tsx`
- `src/components/ad-director/ScriptInput.tsx`

هدف این است که اگر اعتبار AI تمام بود، همه‌جا فقط پیام کاربرپسند دیده شود، نه خطای runtime.

## جزئیات فنی

```text
Click AI Prompt
  -> ChatPromptBar
  -> invokeEdgeFunction("ad-director-ai", { action: "write-script" })
  -> ad-director-ai
  -> AI provider returns credits exhausted
  -> current behavior: HTTP 402
  -> preview treats it as runtime error
  -> user sees toast + black error overlay
```

### رفتار مطلوب
```text
Click AI Prompt
  -> ad-director-ai returns { ok:false, status:402, error:"AI credits exhausted." } with safe response handling
  -> client classifies it as recoverable
  -> only destructive toast is shown
  -> dialog closes / state resets
  -> page stays interactive
```

## محدوده تغییر
- بدون تغییر دیتابیس
- بدون تغییر RLS
- بدون تغییر معماری اصلی Ad Director
- فقط fix روی error-handling همین flow

## اعتبارسنجی بعد از اجرا

1. روی **AI Prompt** کلیک شود وقتی اعتبار AI تمام است:
   - فقط toast قرمز نمایش داده شود
   - کارت سیاه error overlay دیگر ظاهر نشود
   - صفحه سفید یا blank screen نشود

2. روی **AI Prompt** کلیک شود وقتی اعتبار کافی وجود دارد:
   - متن پرامپت داخل preview dialog نمایش داده شود
   - دکمه `Use this prompt` درست کار کند

3. سناریوی `429`:
   - فقط پیام rate limit دیده شود
   - UI قفل نکند

4. `CharacterPromptDialog` و `ScriptInput` هم با همین نوع خطا gracefully رفتار کنند.

## نتیجه مورد انتظار
بعد از این اصلاح، دلیل خطا همچنان شفاف می‌ماند: **اعتبار AI تمام شده**.  
اما دیگر این وضعیت به‌صورت crash یا runtime error به کاربر نمایش داده نمی‌شود، و صفحه `/ad-director` کاملا usable باقی می‌ماند.
