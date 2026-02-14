

# اصلاح زبان ویزی — بریفینگ انگلیسی، صحبت فارسی فقط وقتی بخوای

## مشکل فعلی

الان `preferred_language: "fa"` باعث میشه **همه چیز** فارسی بشه — بریفینگ روزانه، voice chat، و context. ولی تو میخوای:

- **Daily Briefing**: همیشه انگلیسی
- **Voice Chat**: پیش‌فرض انگلیسی، ولی وقتی بگی "فارسی صحبت کن" ویزی فارسی بشه

## تغییرات

### 1. `supabase/functions/vizzy-daily-brief/index.ts` — همیشه انگلیسی

سیستم پرامپت الان میگه "اگه تعاملات اخیر فارسی بود، فارسی جواب بده". این باید عوض بشه به: **همیشه انگلیسی** برای بریفینگ.

خطوط 85-90 (بلاک LANGUAGE) حذف بشن و جایگزین بشن با:
```
Always respond in English for the daily briefing.
```

### 2. `src/lib/vizzyContext.ts` — حذف MANDATORY LANGUAGE DIRECTIVE

بلاک `langDirective` که وقتی `preferredLanguage === "fa"` فارسی رو اجبار میکنه، حذف بشه. به جاش فقط دستور بمونه که "به هر زبانی که CEO صحبت میکنه جواب بده" — که الان هست (خط 65-67).

این یعنی:
- پیش‌فرض: انگلیسی
- اگه CEO فارسی حرف بزنه یا بگه "فارسی صحبت کن": فارسی بشه

### 3. `src/pages/VizzyPage.tsx` — حذف ارسال `preferredLang` به context

چون دیگه `buildVizzyContext` نباید زبان رو force کنه، فراخوانی‌ها بدون پارامتر زبان باشن. ولی RTL و status labels فارسی باقی بمونن برای وقتی که Farsi mode فعاله.

## خلاصه فنی

### فایل‌های تغییر یافته
1. `supabase/functions/vizzy-daily-brief/index.ts` — سیستم پرامپت: همیشه انگلیسی
2. `src/lib/vizzyContext.ts` — حذف `langDirective` و پارامتر `preferredLanguage`
3. `src/pages/VizzyPage.tsx` — حذف ارسال زبان به `buildVizzyContext`، نگه داشتن RTL برای Farsi mode

### منطق جدید
```text
Daily Briefing → Always English
Voice Chat (ElevenLabs mode) → English by default, switch to Farsi when user asks
Voice Chat (Farsi mode) → Always Farsi (this is the explicit Farsi toggle)
```
