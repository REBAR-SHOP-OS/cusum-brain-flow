
## ریشه‌ی مسئله — تأیید‌شده

عکس character آپلود می‌شود و url آن (`characterImageUrl`) درست به همه‌جا منتقل می‌شود (analyze → write-prompt → generate-video). پس "اتصال" سالم است. **ولی تصویر ساخته‌شده از شخصیت دیگری استفاده می‌کند**. سه دلیل ریشه‌ای وجود دارد:

### ۱. پرامت نهایی، شخصیت را با کلمات بازتعریف می‌کند
در `backgroundAdDirectorService.ts` خط 494، prefix continuity شامل `subject: ${cp.subjectDescriptions}` است. این subject را LLM در analyze نوشته (مثلاً «یک مرد ریش‌دار با موی نقره‌ای در لباس کار صنعتی»). وقتی این متن به Wan i2v داده می‌شود، **مدل بین تصویر مرجع و توصیف متنی تعارض می‌بیند و معمولاً به متن وزن بیشتری می‌دهد** → نتیجه: شخصیت دیگری.

### ۲. دستور فقط «describe consistently» است، نه «از تصویر مرجع کپی کن»
در edge function `ad-director-ai/index.ts` خط 646 فقط می‌گوید *"describe this person as the central subject"* — این به LLM اجازه می‌دهد فرد را با کلمات اختراع کند. هیچ دستور صریحی وجود ندارد که **چهره/ویژگی‌ها از img_url گرفته شود و در متن توصیف نشود**.

### ۳. negative prompt، انحراف چهره را پوشش نمی‌دهد
در خط 548 فقط against text/watermark است. هیچ "different person, face change, identity drift" در negative prompt نیست.

---

## برنامه‌ی اصلاحی (Surgical, 2 فایل)

### فایل ۱ — `src/lib/backgroundAdDirectorService.ts`

#### تغییر A: حذف توصیف کلامی subject وقتی character ref موجود است
خط 493-495 — وقتی `characterImageUrl` موجود است، **`subject` را از `continuityPrefix` حذف کنیم** تا با تصویر مرجع تعارض نکند:
```ts
const continuityPrefix = cp
  ? `[Visual continuity: ${cp.environment || ""}, ${cp.lightingType || ""}, ${cp.colorMood || ""}` +
    (characterImageUrl 
      ? `, wardrobe-and-look: see reference image (do not re-describe person)` 
      : `, subject: ${cp.subjectDescriptions || ""}, wardrobe: ${cp.wardrobe || ""}`) +
    `] `
  : "";
```

#### تغییر B: اضافه‌کردن دستور صریح به finalPrompt در i2v
خطوط 534-538 — وقتی `usingCharacter`، یک hard constraint اضافه شود:
```ts
const finalPrompt = (usingCharacter)
  ? `[CHARACTER LOCK: The person in the reference image is the EXACT spokesperson — preserve their face, skin tone, hair, age, ethnicity, and clothing identically. Do NOT generate a different person.]\n${motionPrompt}` +
    (characterPrompt?.trim() ? `\n\nCharacter direction: ${characterPrompt.trim()}` : "")
  : motionPrompt;
```

#### تغییر C: تقویت negative prompt برای i2v
خط 548 — وقتی `isI2V && characterImageUrl`، اضافه کنیم:
```ts
negativePrompt: `${baseNegative}, different person, different face, identity change, face swap, wrong ethnicity, wrong age, generic stock person, replaced subject`
```

### فایل ۲ — `supabase/functions/ad-director-ai/index.ts`

#### تغییر D: write-cinematic-prompt — منع توصیف چهره وقتی ref موجود است
خط 646 جایگزین شود با:
```ts
${characterImageUrl ? `\nCHARACTER REFERENCE (CRITICAL): A reference photo is provided as img_url to the video model. The prompt MUST:
- Refer to "the spokesperson shown in the reference image" — DO NOT describe their face, age, ethnicity, hair color, or facial features in words.
- Only describe their ACTIONS (gestures, walking, speaking, demonstrating) and the environment around them.
- Wardrobe should be referenced as "wearing the same outfit as in the reference image" unless the scene explicitly requires a change.
- This prevents the video model from drifting to a different person.` : ""}
```

#### تغییر E: analyze-script — همان قانون برای continuityProfile.subjectDescriptions
خط 549-555 جایگزین شود تا LLM مجبور شود `subjectDescriptions` را به‌صورت neutral بنویسد:
```ts
const characterBlock = characterImageUrl
  ? `\n\nIMPORTANT — CHARACTER REFERENCE (img_url will be passed to video model):
- Set generationMode to "image-to-video" for every non-static-card scene.
- In continuityProfile.subjectDescriptions, write ONLY: "the spokesperson shown in reference image" — DO NOT describe their face/age/ethnicity/hair (this would conflict with the actual photo).
- In continuityProfile.wardrobe, write: "as worn in reference image".
- Scene actions should describe what the person DOES, not how they LOOK.
- Never mention "a man", "a woman", "bearded", "elderly", etc. — let the image speak for itself.`
  : "";
```

---

## نتیجه پس از اصلاح

- متن پرامت دیگر چهره را بازتعریف نمی‌کند → Wan i2v به `img_url` وزن کامل می‌دهد
- دستور صریح "CHARACTER LOCK" در ابتدای پرامت نهایی، مدل را قفل می‌کند
- negative prompt جلوی identity drift را می‌گیرد
- `subjectDescriptions` در continuity profile به‌صورت neutral ذخیره می‌شود تا در سناریوهای آینده هم تعارض نکند

## آنچه تغییر **نمی‌کند**
- آپلود و انتقال `characterImageUrl` — بدون تغییر
- منطق انتخاب i2v vs t2v — بدون تغییر
- `CharacterPromptDialog` و UI — بدون تغییر
- منطق intro/outro reference — بدون تغییر
- دیتابیس و RLS — بدون تغییر
