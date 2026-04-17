

## ریشه‌ی مشکل

دکمه **Auto Music** الان کار می‌کند اما prompt ضعیف است:
- `"Cinematic instrumental advertising background music for: <متن کل صحنه‌ها>"`
- متن صحنه‌ها (که شامل voiceover/narration و کلمات گفتاری است) به‌عنوان prompt به ElevenLabs Music ارسال می‌شود
- مدل music گاهی این متن را به‌عنوان **lyrics** تفسیر می‌کند → خروجی ممکن است شامل **vocal/کلام** باشد یا ربط معنایی مستقیم با متن نداشته باشد و حال‌و‌هوای ویدئو را منتقل نکند

## انتظار کاربر
وقتی **Auto Music** زده می‌شود → موسیقی **کاملاً بی‌کلام (instrumental فقط)** که **mood/تم** ویدئو را منتقل می‌کند، نه ترجمه‌ی متنی narration.

---

## برنامه‌ی اصلاحی (یک فایل، سطحی)

### فایل: `src/components/ad-director/ProVideoEditor.tsx` (تابع `generateBackgroundMusic` خط 1460-1510)

**A. استخراج mood به‌جای ارسال متن خام**
به‌جای الصاق `allTexts` (که شامل dialog/narration است)، یک تحلیل سبک سبک از محتوای ویدئو انجام می‌دهیم:
- از `brand.industry`, `brand.tone` (اگر موجود)، تعداد و نوع صحنه‌ها (`scene.style`/`scene.mood` در storyboard) برای ساخت یک **mood descriptor** استفاده می‌کنیم
- فقط چند کلمه‌ی کلیدی (نه جمله کامل) از متن استخراج می‌کنیم — مثلاً موضوع کلی (industry/product) — نه عین narration

**B. Prompt جدید — تأکید مطلق بر instrumental**
```ts
const moodKeywords = deriveMood(storyboard, brand); // "corporate, confident, modern construction"
const musicPrompt = 
  `Pure instrumental background music, NO vocals, NO lyrics, NO singing, NO human voice. ` +
  `Style: cinematic corporate advertising soundtrack. ` +
  `Mood: ${moodKeywords}. ` +
  `Tempo: medium, building energy. ` +
  `Instruments: orchestral strings, subtle percussion, ambient synth pads. ` +
  `Suitable for B2B brand video background — must not compete with voiceover narration.`;
```

**C. تابع کوچک `deriveMood`** (داخل همان فایل، بدون export)
- input: `storyboard[]` و `brand`
- اگر `brand.industry` وجود دارد → از آن استفاده می‌کنیم (construction, tech, retail, …)
- در غیر این صورت، از `scene.style` یا fallback عمومی `"professional, uplifting, corporate"`
- خروجی: یک رشته‌ی 3-5 کلمه‌ای mood

**D. حفظ duration و بقیه‌ی منطق** — هیچ تغییری در فراخوانی edge function، بلاب‌سازی، یا افزودن track به timeline نمی‌دهیم.

### آنچه دست‌نخورده می‌ماند
- Edge function `lyria-music` و `elevenlabs-music` — هیچ تغییری
- منطق timeline / audio track seeding — هیچ تغییری
- Voiceover / TTS pipeline — هیچ تغییری
- DB / RLS / storage — هیچ تغییری

## نتیجه پس از اصلاح
1. ✅ موسیقی تولیدشده **بی‌کلام مطلق** خواهد بود (با تأکید چندباره NO vocals/lyrics/singing در prompt)
2. ✅ Mood موسیقی با تم ویدئو/برند تطابق دارد، نه ترجمه‌ی عین متن narration
3. ✅ موسیقی به‌عنوان background مناسب است و با voiceover تداخل ندارد (orchestral/ambient، نه pop/rock با vocals)
4. ✅ همان UX قبلی — کلیک روی Auto Music، loader، track در timeline

