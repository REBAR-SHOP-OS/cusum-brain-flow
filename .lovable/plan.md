

# تقویت دو قانون الزامی ایجنت Pixel: لوگو اجباری + تصویر غیرتکراری

## وضعیت فعلی

### ۱. لوگو
- تابع `resolveLogoUrl()` لوگو را از `social-images/brand/company-logo.png` می‌خواند
- اگر فایل لوگو وجود نداشته باشد، **بدون لوگو ادامه می‌دهد** (خط ۲۰۳-۲۰۴)
- در `generatePixelImage` هم اگر `logoUrl` خالی باشد، تصویر بدون لوگو تولید می‌شود (خط ۲۴۸)

### ۲. تکراری نبودن
- از `sessionSeed` (UUID) استفاده می‌شود ولی فقط به صورت متنی در prompt تزریق می‌شود — هیچ بررسی واقعی با تصاویر قبلی انجام نمی‌شود

---

## تغییرات پیشنهادی

### فایل: `supabase/functions/ai-agent/index.ts`

**تغییر ۱ — لوگو اجباری:**
- در `generatePixelImage`: اگر `logoUrl` خالی یا `null` باشد، **بلافاصله خطا برگرداند** و تصویر تولید نشود
- پیام خطا: `"Company logo is required but not found in storage. Upload logo to social-images/brand/company-logo.png"`
- حذف حالت‌های `useLogo: false` از آرایه `attempts` (هر سه attempt باید `useLogo: true` باشند — که الان هست)

**تغییر ۲ — جلوگیری از تکرار:**
- قبل از تولید تصویر، prompt‌های تصاویر قبلی همان روز را از جدول `social_posts` یا از bucket `social-images/pixel/` بخوانیم
- لیست prompt‌های قبلی را به prompt جدید تزریق کنیم با دستور "MUST NOT resemble any of these previous images"
- همچنین هش prompt نهایی را ذخیره کنیم تا prompt دقیقاً یکسان هرگز اجرا نشود

**تغییر ۳ — تقویت prompt سیستم در `marketing.ts`:**
- اضافه کردن قانون صریح: "If company logo cannot be loaded, STOP and report error — never generate without logo"
- اضافه کردن قانون: "Every image must be visually unique — check previous prompts and ensure completely different composition, colors, angles"

### فایل: `supabase/functions/_shared/agents/marketing.ts`
- افزودن دو قانون جدید به بخش `IMAGE RULES`

---

## جزئیات فنی

### لوگو اجباری — `generatePixelImage` (خط ۲۱۸-۲۲۲)
```typescript
// Add at the start of the function, after LOVABLE_API_KEY check:
if (!logoUrl) {
  return { 
    imageUrl: null, 
    error: "Company logo is REQUIRED. Upload it to social-images/brand/company-logo.png" 
  };
}
```

### ضد تکرار — قبل از حلقه تولید تصویر (خط ~۵۳۰)
- خواندن ۲۰ تصویر آخر از bucket `social-images/pixel/` 
- استخراج نام فایل‌ها و تزریق به prompt به عنوان "previously generated — avoid similar themes"
- افزودن تایم‌استمپ دقیق و شماره تصادفی به prompt برای اطمینان بیشتر

### تقویت prompt سیستم
```
## IMAGE RULES (additions)
- LOGO IS MANDATORY — if the logo cannot be loaded, DO NOT generate any image. Report error immediately.
- EVERY image MUST be visually UNIQUE — different composition, color palette, camera angle, and layout from ALL previous generations. NEVER produce a similar-looking image.
```

