

# رفع خطای 403 — Gemini API Key دوم نیز Leaked شده

## تشخیص
لاگ خطا واضح است:
```
AI API error: 403 — "Your API key was reported as leaked. Please use another API key."
```

این خطا در `extract-manifest` (و سایر فانکشن‌ها مثل `generate-fix-prompt`) اتفاق می‌افتد چون از `aiRouter.ts` → `getProviderConfig("gemini")` → `Deno.env.get("GEMINI_API_KEY")` استفاده می‌کنند.

**نکات کلیدی از بررسی:**
1. در لیست secrets، **دو کلید Gemini** وجود دارد:
   - `GEMINI_API_KEY` ← این همانی است که `aiRouter.ts` می‌خواند
   - `GEMENI_API_KEY` ← یک کلید با املای اشتباه (احتمالاً قدیمی، بدون استفاده)
2. در پیام قبلی شما کلیدی را آپدیت کردید، اما خطا برمی‌گردد — این یعنی **یا کلید جدیدی که وارد کردید هم توسط Google leaked تشخیص داده شده** (Google در عرض چند ثانیه کلیدهای ظاهرشده در GitHub/discord/سایت‌های عمومی را detect می‌کند)، **یا** کلید را در slot اشتباه (مثلاً `GEMENI_API_KEY`) ذخیره کردید.
3. `extract-manifest` دارای fallback به `gpt-5` هست **اما fallback فقط برای statusهای 429/503/504 trigger می‌شود** (line 128 در `aiRouter.ts`)، نه برای 403. بنابراین خطای 403 مستقیماً به کاربر نمایش داده می‌شود.

## راه‌حل دو-مرحله‌ای

### مرحلهٔ ۱ (فوری) — تولید و ذخیرهٔ کلید Gemini کاملاً جدید
به‌محض تأیید پلن، از ابزار update-secret برای `GEMINI_API_KEY` استفاده می‌کنم. شما باید:

1. به https://aistudio.google.com/apikey بروید.
2. **هر دو کلید قبلی را revoke کنید** (هم آنکه دفعهٔ قبل دادید و هم قدیمی‌تر).
3. **یک پروژهٔ Google Cloud جدید** بسازید (یا پروژه‌ای متفاوت از قبلی انتخاب کنید) — این کار باعث می‌شود hash کلید کاملاً نو باشد و در blacklist لو رفته نباشد.
4. در آن پروژه یک API key تازه بسازید.
5. **هرگز این کلید را در هیچ فایل، چت، اسکرین‌شات، یا گیت قرار ندهید** — مستقیماً در dialogی که Lovable باز می‌کند paste کنید.
6. در Google Cloud Console → APIs & Services → Credentials → روی کلید کلیک کنید → بخش **Application restrictions** را روی `None` بگذارید و **API restrictions** را به `Generative Language API` محدود کنید (این مهم نیست برای رفع 403 ولی best practice است).

### مرحلهٔ ۲ (مقاوم‌سازی) — افزودن fallback خودکار به GPT برای خطای 403
در `supabase/functions/_shared/aiRouter.ts` تغییر جزئی می‌دهم تا اگر در آینده Gemini با 403 (leaked/permission) برگشت، به‌صورت خودکار به provider جایگزین (GPT) سوئیچ کند به‌جای failed شدن کل extract.

**تغییر نقطه‌ای در `aiRouter.ts` (~line 128):**
```ts
// قبل:
if ((e.status === 429 || e.status === 503 || e.status === 504) && opts.fallback) {
// بعد:
if ((e.status === 429 || e.status === 403 || e.status === 503 || e.status === 504) && opts.fallback) {
```
به‌علاوه یک `console.warn` مشخص که علت 403 (leaked key) را در لاگ ثبت کند تا دفعهٔ بعد سریع تشخیص داده شود.

## آنچه دست نمی‌خورد
- منطق `extract-manifest`، `qb-audit`، `generate-fix-prompt` و سایر مصرف‌کننده‌های `callAI` — بدون تغییر.
- Circuit breaker، policy router، logging — بدون تغییر.
- نام secret (`GEMINI_API_KEY`) — بدون تغییر. کلید با همین نام آپدیت می‌شود.
- هیچ migration دیتابیسی لازم نیست.

## اعتبارسنجی
1. بعد از paste کلید جدید توسط شما، فانکشن‌ها بلافاصله با کلید جدید اجرا می‌شوند (Supabase Edge Functions کلیدها را hot-reload می‌کنند).
2. Retry روی صفحهٔ Extract Session → استخراج موفق.
3. اگر Google کلید جدید را هم به هر دلیلی leaked تشخیص دهد، با تغییر مرحلهٔ ۲ به‌صورت خودکار به `gpt-5` fallback می‌شود و کاربر extract موفق دریافت می‌کند (به‌جای error 403).
4. در لاگ‌ها، fallback با پیام واضح `[gemini-403-fallback]` ثبت می‌شود.

