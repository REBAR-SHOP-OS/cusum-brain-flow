

# اتصال واقعی تولید تصویر به ChatGPT (gpt-image-1)

## مشکل فعلی

دو مسیر تولید تصویر وجود دارد و هیچ‌کدام وقتی کاربر ChatGPT را انتخاب می‌کند، از مدل تصویرسازی OpenAI استفاده نمی‌کنند:

1. **Image Generator Dialog** (`ImageGeneratorDialog.tsx`): مدل را از `selectedModel` می‌گیرد ولی لیست مدل‌ها فقط شامل مدل‌های Gemini است.
2. **Pixel Agent** (تولید خودکار در چت): تابع `generatePixelImage` همیشه از `google/gemini-2.5-flash-image` استفاده می‌کند و `preferredModel` به آن پاس داده نمی‌شود.

## تغییرات لازم

### 1. Edge Function: `supabase/functions/ai-agent/index.ts`
- پارامتر `preferredModel` را به `generatePixelImage` پاس بده
- اگر `preferredModel === "chatgpt"` باشد، از OpenAI `gpt-image-1` مستقیماً (با `GPT_API_KEY`) برای تولید تصویر استفاده شود
- ترتیب مدل‌ها در `attempts` بر اساس `preferredModel` تنظیم شود:
  - ChatGPT → `gpt-image-1` اول، سپس Gemini به عنوان fallback
  - Gemini (پیش‌فرض) → رفتار فعلی حفظ شود

### 2. Edge Function: `supabase/functions/generate-image/index.ts`
- بدون تغییر — این فایل در حال حاضر هم Gemini و هم OpenAI را پشتیبانی می‌کند (خطوط 245-285)

### 3. Edge Function: `supabase/functions/regenerate-post/index.ts`
- همان منطق `preferredModel` را به `generatePixelImage` اضافه کن

### جزئیات فنی تغییر `generatePixelImage`

```text
generatePixelImage(prompt, svcClient, logoUrl, options)
                                                    ↓ add preferredModel
generatePixelImage(prompt, svcClient, logoUrl, options)
  options.preferredModel === "chatgpt"
    → POST https://api.openai.com/v1/images/generations
      model: "gpt-image-1", prompt, size: "1024x1024"
    → fallback to Gemini if fails
  default
    → existing Gemini flow (unchanged)
```

- OpenAI Images API برمی‌گرداند: `data[0].b64_json` یا `data[0].url`
- همان منطق آپلود به storage bucket اعمال می‌شود

### فایل‌های ویرایشی
- `supabase/functions/ai-agent/index.ts` — اضافه کردن مسیر OpenAI به `generatePixelImage` و پاس دادن `preferredModel`
- `supabase/functions/regenerate-post/index.ts` — همسان‌سازی

