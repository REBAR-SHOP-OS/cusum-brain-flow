

# ویزی رو فارسی کن وقتی زبان کاربر فارسیه

## خلاصه تغییرات

وقتی `preferred_language` کاربر `fa` هست، ویزی باید:
1. **پیش‌فرض فارسی صحبت کنه** — نه فقط وقتی CEO فارسی حرف بزنه
2. **متن‌های نمایشی RTL باشن** — interim text و status label
3. **Context قوی‌تر بفرسته** — به جای یه hint ساده، دستور صریح بده

## تغییرات فایل‌ها

### 1. `src/lib/vizzyContext.ts` — پارامتر زبان اضافه شه

تابع `buildVizzyContext` یه پارامتر اختیاری `preferredLanguage` بگیره. وقتی `fa` هست، بالای system prompt یه بلاک قوی اضافه بشه:

```
MANDATORY LANGUAGE: Your preferred language is FARSI (Persian).
You MUST respond in Farsi by default. Use colloquial Iranian Farsi.
Only switch to English if the CEO explicitly speaks English.
All numbers can stay in Western digits but text MUST be in Farsi.
```

### 2. `src/pages/VizzyPage.tsx` — زبان رو به context پاس بده

- `buildVizzyContext(snap)` رو به `buildVizzyContext(snap, detectedLang)` تغییر بده
- خط `langCtx` دیگه لازم نیست چون داخل context اصلی هندل میشه
- Status labels که الان فقط توی Farsi mode فارسی هستن، وقتی `preferredLang === "fa"` هم فارسی بشن (حتی توی ElevenLabs mode)
- `dir="rtl"` روی status label و interim text وقتی زبان فارسیه

### 3. Farsi mode context — همون تغییر

توی بلاک Farsi mode هم `buildVizzyContext(snap, "fa")` فرستاده بشه تا context یکپارچه باشه.

## جزئیات فنی

### تغییرات `vizzyContext.ts`

```typescript
export function buildVizzyContext(snap: VizzyBusinessSnapshot, preferredLanguage?: string): string {
  // ... existing code ...
  
  const langDirective = preferredLanguage === "fa" 
    ? `\n═══ MANDATORY LANGUAGE DIRECTIVE ═══
YOUR DEFAULT LANGUAGE IS FARSI (PERSIAN). 
You MUST respond in Farsi unless the CEO explicitly speaks English.
Use natural, colloquial Iranian Farsi (like a native Tehran speaker).
Keep technical terms and proper nouns in English when natural.
═══ END LANGUAGE DIRECTIVE ═══\n`
    : "";

  return `YOU ARE VIZZY — ...
${langDirective}
...rest of context`;
}
```

### تغییرات `VizzyPage.tsx`

- خط ۴۴۸: `buildVizzyContext(snap)` به `buildVizzyContext(snap, "fa")`
- خط ۴۷۲: `buildVizzyContext(snap)` به `buildVizzyContext(snap, detectedLang)`
- خط ۵۴۰-۵۴۹: Status labels با شرط `preferredLang === "fa"` به جای فقط `useFarsiMode`
- خط ۶۰۲-۶۲۱: اضافه کردن `dir="rtl"` به بلاک‌های متنی وقتی `preferredLang === "fa"`

### فایل‌های تغییر یافته
1. `src/lib/vizzyContext.ts`
2. `src/pages/VizzyPage.tsx`

