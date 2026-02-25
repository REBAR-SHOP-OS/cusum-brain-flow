
# Pixel Image Generation — Fixed ✅

## مشکلات حل‌شده:

1. **گارد تولید تصویر در جای اشتباه بود** → منتقل شد به بعد از schedule guardrail، فقط برای `agent === "social"`
2. **تصویر واقعی تولید نمی‌شد** → `generatePixelImage` بازنویسی شد: از Lovable AI gateway (`gemini-2.5-flash-image`) استفاده می‌کند، base64 را آپلود می‌کند در `social-images` bucket، و URL عمومی برمی‌گرداند
3. **لوگو enforce نمی‌شد** → لوگو از knowledge خوانده می‌شود + قبل از ارسال به مدل، URL لوگو بررسی (HEAD check) و در صورت معتبر بودن به‌عنوان ورودی تصویری ارسال می‌شود
4. **اطلاعات تماس اشتباه بود** → شماره تماس به `647-260-9403` و آدرس به `9 Cedar Ave, Thornhill, Ontario` اصلاح شد
5. **placeholder متنی به‌جای تصویر** → حذف شد، همیشه markdown image واقعی `![...](url)` نمایش داده می‌شود
6. **مدل کند بود** → از `gemini-3-pro-image-preview` (timeout) به `gemini-2.5-flash-image` (سریع) تغییر یافت

## فایل‌های تغییریافته:
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/_shared/agentToolExecutor.ts`  
- `supabase/functions/_shared/agents/marketing.ts`

## تست:
- ✅ ارسال `1` → تصویر واقعی + کپشن + هشتگ + تماس
- ✅ modelUsed = "deterministic-pixel"
- ✅ تصویر بالای کپشن نمایش داده می‌شود
