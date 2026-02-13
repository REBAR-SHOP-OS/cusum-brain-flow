

# رفع مشکل تولید نشدن تصویر در ایجنت Pixel

## مشکل شناسایی‌شده

لاگ‌ها نشان می‌دهند که هر 5 درخواست تولید تصویر با خطای **400** از OpenAI رد می‌شوند:

```text
Image 1 generation failed: 400
Image 2 generation failed: 400
...
Image 5 generation failed: 400
📸 Pixel: 0/5 images generated successfully
```

متن خطا لاگ نمی‌شود، اما دلایل احتمالی 400:
- پارامتر `output_format: "png"` ممکن است برای `gpt-image-1` پشتیبانی نشود
- prompt خیلی طولانی باشد
- مشکل content policy

## راه‌حل

**تغییر مدل تولید تصویر از OpenAI به Lovable AI Gateway (Gemini Image)**

به جای استفاده از `gpt-image-1` که به `GPT_API_KEY` نیاز دارد و خطا می‌دهد، از مدل `google/gemini-2.5-flash-image` از طریق Lovable AI Gateway استفاده می‌کنیم. این مدل:
- نیازی به API Key جداگانه ندارد (از `LOVABLE_API_KEY` موجود استفاده می‌کند)
- پایدارتر است
- تصاویر را به‌صورت base64 برمی‌گرداند

همچنین خطای 400 را لاگ می‌کنیم تا اگر مشکلی در آینده پیش آمد قابل ردیابی باشد.

## تغییر فنی

### فایل: `supabase/functions/ai-agent/index.ts`

بخش تولید تصویر (خطوط 3886-3901) تغییر می‌کند:

**قبل (خراب):**
```typescript
const imgResp = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  headers: { "Authorization": `Bearer ${GPT_API_KEY}` },
  body: JSON.stringify({
    model: "gpt-image-1",
    prompt: post.image_prompt,
    size: "1536x1024",
    quality: "high",
    output_format: "png",
    n: 1,
  }),
});
```

**بعد (درست):**
```typescript
const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${LOVABLE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash-image",
    messages: [{ role: "user", content: post.image_prompt }],
    modalities: ["image", "text"],
  }),
});
```

- پاسخ Gemini حاوی `images[0].image_url.url` با فرمت `data:image/png;base64,...` است
- base64 را decode کرده و در storage آپلود می‌کنیم (مانند قبل)
- شرط `if (GPT_API_KEY)` حذف می‌شود چون دیگر نیازی به آن نیست

### تغییرات اضافی:
- لاگ کردن متن خطا در صورت شکست (`imgResp.text()`)
- حذف وابستگی به `GPT_API_KEY` برای تولید تصویر در Pixel

هیچ تغییری در فرانت‌اند لازم نیست.

