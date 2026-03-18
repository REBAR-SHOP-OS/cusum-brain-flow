

## مشکل: تصویر تولید شده در چت Pixel به صورت پیش‌نمایش نمایش داده نمی‌شود

### تشخیص علت
در `PixelChatRenderer.tsx` تابع `extractPostData` فقط فرمت `![caption](url)` (image markdown) را شناسایی می‌کند. اما LLM گاهی تصویر را به صورت `[caption](url)` (link markdown بدون `!`) برمی‌گرداند. فالبک bare URL هم URLهایی که قبلشان `](` باشد را skip می‌کند. نتیجه: URL تصویر پیدا نمی‌شود → هیچ PixelPostCard رندر نمی‌شود → فقط متن نمایش داده می‌شود.

### راه‌حل

**فایل: `src/components/social/PixelChatRenderer.tsx`**

در تابع `extractPostData`، بعد از regex اصلی `![...](...)` یک regex ثانویه برای `[...](social-images-url)` اضافه شود:

```
const linkRegex = /(?<!!)\[([^\]]*)\]\((https?:\/\/[^\s)]*social-images[^\s)]*)\)/g;
```

این regex لینک‌های markdown معمولی (بدون `!`) که URL آنها شامل `social-images` است را هم شناسایی می‌کند. اگر regex اصلی نتیجه‌ای نداشت، از این regex استفاده شود — قبل از فالبک bare URL.

### فایل‌های تغییر
- `src/components/social/PixelChatRenderer.tsx` — افزودن regex ثانویه در `extractPostData`

