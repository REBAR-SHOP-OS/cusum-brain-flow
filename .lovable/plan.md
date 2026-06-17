# انتقال موتور تولید عکس به اپ دیگر

می‌خوام «راز پخت» عکس‌های REBAR.SHOP رو طوری بسته‌بندی کنم که هر اپ دیگه‌ای (Lovable یا Node یا Deno) بتونه از همون الگو استفاده کنه. هم سند توضیحی می‌سازم، هم یه فایل کد مستقل.

## چرا عکس‌ها انقدر خوب درمیان (خلاصه)

مدل پایه `google/gemini-3-pro-image-preview` روی Lovable AI Gateway. اما کیفیت واقعی از این ۴ لایه میاد:

1. **رفرنس بصری از Pexels** — قبل از تولید، با کلیدواژه‌های پرامپت یه عکس واقعی از Pexels می‌گیریم و به‌عنوان ورودی دوم به مدل می‌دیم. این تنها چیزیه که خروجی رو از CGI/illustration به photorealistic می‌بره.
2. **پرامپت ساختاریافته با قوانین سخت** — ABSOLUTE RULES (فقط photoreal، ممنوعیت CGI/3D/cartoon)، قید aspect ratio به‌صورت متنی، بخش MANDATORY ADVERTISING BANNER (headline + wordmark + CTA به‌صورت baked-in)، قید زبان فقط انگلیسی، انتخاب تصادفی از ۱۲ سبک بصری.
3. **Brand Context + Logo + Pixel Brain** — تزریق نام برند/tagline/value_prop/شماره، لوگو به‌عنوان image دوم با دستور «prominent، not watermark»، و رفرنس‌های محصول واقعی از جدول `knowledge`.
4. **Post-processing سرور** — برش دقیق به ابعاد رسانه (Story 1080×1920 و …) با `cropToAspectRatioStrict` چون مدل گاهی aspect ratio رو رعایت نمی‌کنه.

## چیزی که می‌سازم

### فایل ۱ — `docs/image-generation-recipe.md`
سند کامل (~۳۰۰ خط) شامل:
- توضیح ۴ لایه با مثال
- پرامپت کامل `buildAdPrompt` به‌صورت template آماده کپی
- لیست ۱۲ سبک بصری
- ساختار request به Gateway (headers, body, modalities)
- ساختار response و نحوه extract کردن image
- نکات: retry بر 429، fallback به base64 در content، crop بعد از تولید
- چک‌لیست انتقال به اپ دیگه

### فایل ۲ — `src/lib/imageGenRecipe/generateAdImage.ts`
یک helper تک‌فایلی، self-contained، بدون وابستگی به Pixel Brain این پروژه. امضا:
```ts
generateAdImage({
  prompt, brandContext, logoUrl?, aspectRatio?,
  lovableApiKey, pexelsApiKey?,
}) => Promise<{ imageUrl: string }>
```
هم در Deno (Edge Function) هم در Node (با fetch) کار می‌کنه. فقط `LOVABLE_API_KEY` لازم داره؛ Pexels اختیاریه ولی قویاً توصیه‌شده.

### فایل ۳ — `docs/image-generation-recipe.example.ts`
یک نمونه ۲۰ خطی که نشون می‌ده چجوری از helper در یه Edge Function جدید استفاده بشه.

## چیزی که تغییر نمی‌کنه
- `supabase/functions/generate-image/index.ts` (پروژه فعلی) دست نمی‌خوره
- هیچ migration یا تغییر DB نیست
- هیچ secret جدیدی اضافه نمی‌شه

## تأیید
بعد از ساخت، فقط فایل‌ها رو re-read می‌کنم تا مطمئن بشم syntax درسته. تست runtime لازم نیست چون فقط documentation + helper مستقل اضافه می‌شه.
