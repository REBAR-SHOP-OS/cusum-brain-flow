

## رفع مشکل نمایش تصاویر تولید شده در چت Pixel

### مشکل
تصاویر با موفقیت تولید می‌شوند (لاگ: "5/5 images generated successfully") اما در چت به صورت `![Rebar Cages]` شکسته نمایش داده می‌شوند. دلیل: تصاویر base64 خیلی بزرگ هستند (هر کدام 2-5 مگابایت) و ارسال 5 تصویر (10-25 مگابایت) در یک پاسخ JSON از محدودیت اندازه پاسخ edge function فراتر می‌رود.

### راه‌حل
تصاویر تولید شده را به Supabase Storage آپلود کنیم و لینک عمومی (public URL) آنها را در پاسخ Markdown برگردانیم.

### تغییرات

**فایل: `supabase/functions/ai-agent/index.ts`**

1. بعد از تولید هر تصویر (base64)، آن را به باکت `social-images` در Storage آپلود کنیم
2. URL عمومی تصویر را به جای داده base64 در پاسخ استفاده کنیم
3. نام فایل: `pixel/{date}/{slot-index}.png`

**مرحله اضافی: ایجاد Storage Bucket**
- ایجاد باکت `social-images` با دسترسی عمومی (public) برای خواندن

### جریان جدید

```text
1. AI تصویر base64 تولید می‌کند
2. base64 به بایت تبدیل می‌شود
3. بایت‌ها به Storage آپلود می‌شوند: social-images/pixel/2026-02-11/post-1.png
4. URL عمومی Storage در Markdown قرار می‌گیرد
5. پاسخ JSON کوچک و سریع ارسال می‌شود
```

### کد آپلود (منطق اصلی)

در ai-agent بعد از دریافت base64 از OpenAI API:
- تبدیل base64 به Uint8Array
- آپلود به Supabase Storage با createClient
- گرفتن publicUrl و استفاده در پاسخ Markdown

### جزئیات فنی

- باکت `social-images` باید public باشد تا تصاویر بدون auth قابل مشاهده باشند
- مسیر فایل: `pixel/{YYYY-MM-DD}/post-{index}.png` برای سازماندهی
- در صورت خطای آپلود، fallback به base64 (هرچند ممکن است باز هم نمایش ندهد)
- از `createClient` با `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` برای آپلود استفاده می‌شود

