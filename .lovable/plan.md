
## درخواست
الآن دکمه‌ی "Improve with AI" در `CharacterPromptDialog` فقط وقتی کار می‌کند که کاربر **حداقل ۳ کاراکتر** نوشته باشد (و در غیر این‌صورت toast خطا می‌دهد). کاربر می‌خواهد:
- اگر textarea **خالی** باشد → AI خودش از صفر یک پرامت کامل برای character بنویسد
- اگر متن **موجود** باشد → آن را improve کند (مثل الآن)

## بررسی
در `src/components/ad-director/CharacterPromptDialog.tsx` (خط ~46-58):
```ts
const seed = text.trim();
if (seed.length < 3) {
  toast({ title: "Add a starting idea", ... variant: "destructive" });
  return;
}
```
این gate باید برداشته شود و prompt ارسالی به edge function به‌صورت **شرطی** ساخته شود.

`brandContext` (شامل brand voice، product list، style) از parent به dialog پاس داده می‌شود — می‌توان از آن برای generate from-scratch استفاده کرد.

## برنامه (Surgical, Single-File)

### تغییر فقط در `src/components/ad-director/CharacterPromptDialog.tsx`

#### ۱. حذف gate سخت‌گیرانه‌ی ۳ کاراکتری
به جای error toast، اگر textarea خالی بود، حالت **"generate from scratch"** فعال شود.

#### ۲. ساخت instruction شرطی
```ts
const seed = text.trim();
const isGenerating = seed.length === 0;

const instruction = isGenerating
  ? [
      "You WRITE a fresh SHORT character-direction note for an AI video model (image-to-video).",
      "The note describes what THIS specific character (a real person from a reference photo) should SAY and DO on camera to advertise the brand.",
      "Constraints:",
      "- Keep the character's identity, face, body, and clothing UNCHANGED. Do not describe their appearance.",
      "- Focus on: dialogue (what they say), tone of voice, facial expression, eye contact, gestures.",
      "- Cinematic, persuasive, advertising tone. Direct call-to-action at the end.",
      "- 2–4 sentences maximum. No headings, no bullet lists.",
      brandContext ? `Brand context to base the pitch on: ${brandContext}` : "",
      "Return ONLY the direction text — no preamble, no quotes.",
    ].filter(Boolean).join("\n")
  : [ /* existing improve instruction */ ].join("\n");

const userPayload = isGenerating
  ? instruction
  : `${instruction}\n\nUSER NOTE TO IMPROVE:\n${seed}`;
```

#### ۳. به‌روزرسانی UI
- تغییر label دکمه به‌صورت داینامیک:
  - خالی → "✨ Write with AI"
  - دارای متن → "✨ Improve with AI"
- تغییر toast موفقیت متناسب ("✨ Generated" vs "✨ Improved")

#### ۴. حذف condition `seed.length < 3` به‌طور کامل
دکمه در همه حالات فعال می‌ماند (به جز هنگام `improving`).

## آنچه تغییر نمی‌کند
- Edge function `ad-director-ai` — بدون تغییر (همان action `write-script` کار می‌کند)
- منطق Save / Cancel / RTL / preview thumbnail — بدون تغییر
- سایر dialogها و کامپوننت‌ها — بدون تغییر
- پایپلاین generation — بدون تغییر

## نتیجه
کاربر می‌تواند بدون نوشتن هیچ متنی، روی "Write with AI" کلیک کند و AI بر اساس brand context یک character direction کامل و حرفه‌ای تولید می‌کند. اگر متنی موجود باشد، رفتار قبلی (improve) حفظ می‌شود.
