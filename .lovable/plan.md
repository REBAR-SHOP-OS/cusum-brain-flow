
## درک درخواست
کاربر می‌خواهد پرامت تولید‌شده توسط "Write with AI" در `CharacterPromptDialog`:
1. **با توجه به مدت زمان ویدیو** (مثلاً 15s یا 30s) نوشته شود — یعنی متن دیالوگ آنقدر باشد که در آن زمان واقعاً قابل گفتن باشد
2. **محتوای آن صراحتاً تبلیغ شرکت/محصول** باشد — یعنی شخصیت در ویدیو شرکت و محصولات را معرفی و تبلیغ کند (نه فقط حرف کلی)

## بررسی
- در `ChatPromptBar.tsx` (uploaded image-539) دکمه‌ی duration بین Style و Products قرار دارد و مقدارش (مثلاً `15s`) در state موجود است
- `CharacterPromptDialog` فقط `brandContext` می‌گیرد — نه `durationSec` و نه `productContext` ساخت‌یافته
- `ChatPromptBar` این dialog را render می‌کند → دسترسی مستقیم به `durationSec` و لیست محصولات دارد
- AdDirectorContent → ChatPromptBar → CharacterPromptDialog (path پاس دادن props روشن است)

## برنامه (Surgical, Additive)

### تغییر ۱ — `CharacterPromptDialog.tsx`
افزودن دو prop اختیاری:
```ts
interface CharacterPromptDialogProps {
  // ... existing
  durationSec?: number;        // مثلاً 15
  productsContext?: string;    // لیست محصولات/شرکت برای تبلیغ
}
```

در `handleImprove`، instruction مربوط به حالت `isGenerating` بازنویسی می‌شود تا:
- **زمان ویدیو** را صراحتاً قید کند: "Total video length: {durationSec}s. Write dialogue that fits naturally within this duration (~{wordCount} words at normal speaking pace)."
- محاسبه‌ی wordCount: تقریباً `durationSec × 2.3` کلمه (نرخ گفتار طبیعی تبلیغی ~140 wpm)
- **تبلیغ صریح شرکت/محصول** را الزامی کند: "The character MUST explicitly mention the company name and pitch the product/service to viewers. Include: product name, key benefit, call-to-action."
- در صورت موجود بودن `productsContext`، آن را به‌عنوان "Products/Services to advertise:" به prompt اضافه کن
- محدودیت طول جمله متناسب با duration (برای 5-10s → 1-2 جمله، برای 15s → 2-3 جمله، برای 30s → 3-5 جمله)

نمونه instruction جدید برای حالت Generate:
```
You WRITE a fresh character-direction note for an AI video model (image-to-video).
The character (a real person from a reference photo) must ADVERTISE the company and its products on camera.

VIDEO DURATION: {durationSec} seconds (≈ {wordCount} spoken words max)

MUST include:
- Mention the company name explicitly
- Pitch the specific product/service with its key benefit
- End with a clear call-to-action

Constraints:
- Keep the character's identity, face, body, and clothing UNCHANGED. Do not describe their appearance.
- Focus on: dialogue (exact words to say), tone, expression, eye contact, gestures.
- Cinematic, persuasive, sales-driven advertising tone.
- Length: must fit within {durationSec}s when spoken naturally.

Brand context: {brandContext}
Products to advertise: {productsContext}

Return ONLY the direction text — no preamble, no quotes.
```

حالت Improve نیز همان context (duration + products + must-advertise) را دریافت می‌کند تا ویرایش هم در همان framework انجام شود.

### تغییر ۲ — `ChatPromptBar.tsx`
هنگام render کردن `<CharacterPromptDialog ... />`، props جدید پاس داده می‌شود:
- `durationSec={durationSec}` (state موجود — همان مقدار دکمه‌ی 15s/30s)
- `productsContext={productsContext}` — رشته‌ای ساخته‌شده از لیست محصولات انتخاب‌شده + اطلاعات شرکت (در صورت موجود بودن state مربوطه)

در صورت نبود product picker جداگانه، از همان `brandContext` استخراج می‌شود (یا خالی باقی می‌ماند).

## آنچه تغییر نمی‌کند
- Edge function `ad-director-ai` — بدون تغییر
- منطق Save / RTL / preview — بدون تغییر
- AI Prompt dialog کلی — بدون تغییر
- پایپلاین generation — بدون تغییر

## نتیجه
وقتی کاربر روی "Write with AI" در Character dialog کلیک کند، پرامتی تولید می‌شود که:
- دقیقاً برای مدت زمان انتخاب‌شده (5/10/15/30s) طول مناسب دارد
- شخصیت صراحتاً نام شرکت و محصولات را می‌گوید و تبلیغ می‌کند
- شامل CTA است
