

# تزریق Custom Instructions و فایل‌های Brain به تولید تصویر

## مشکل فعلی

Custom Instructions و فایل‌های آپلود‌شده در Pixel Brain فقط در **تولید متن/کپشن** استفاده می‌شوند. در ساخت پرامپت تصویر (`imagePrompt` در خط 657) هیچ اثری از آن‌ها نیست. یعنی وقتی کاربر می‌نویسد «همیشه تصاویر واقع‌گرایانه و غیرتکراری بساز»، این دستور فقط روی متن تاثیر دارد، نه روی عکس.

## تغییرات

### 1. `supabase/functions/ai-agent/index.ts` — تزریق brain context به image prompt

در بخش ساخت `imagePrompt` (خطوط 657-672):

- **Custom Instructions**: متن instructions را از `brainKnowledge` استخراج و به ابتدای image prompt اضافه می‌کنم تا مستقیماً رفتار تولید تصویر را کنترل کند.
- **Resource Images**: URLهای فایل‌های آپلودشده (عکس محصولات و غیره) را به عنوان reference images به content parts ارسال می‌کنم تا مدل تصویرساز بتواند از آن‌ها الهام بگیرد.

```text
imagePrompt (before):
  "MANDATORY REALISM RULE... VISUAL STYLE: X. PRODUCT: Y..."

imagePrompt (after):
  "## USER IMAGE INSTRUCTIONS (MUST FOLLOW):
   همیشه تصاویر واقع گرایانه و غیرتکراری بساز
   
   MANDATORY REALISM RULE... VISUAL STYLE: X. PRODUCT: Y..."
```

- همچنین `generatePixelImage` را آپدیت می‌کنم تا resource image URLها را به عنوان reference تصاویر به مدل ارسال کند (به عنوان `image_url` parts در Gemini path و prompt text در OpenAI path).

### 2. `supabase/functions/regenerate-post/index.ts` — همسان‌سازی

همان منطق تزریق custom instructions به image prompt در regenerate هم اعمال شود.

### جزئیات فنی

- از `brainKnowledge` که قبلاً fetch شده، بخش `USER CUSTOM INSTRUCTIONS` را extract و به `imagePrompt` prepend می‌کنم
- URL فایل‌های resource (عکس محصولات) را به `generatePixelImage` پاس می‌دهم تا به عنوان visual reference اضافه شوند
- برای OpenAI path (gpt-image-1) instructions به prompt text اضافه می‌شود
- برای Gemini path، هم text و هم image references به content parts اضافه می‌شوند

### فایل‌های ویرایشی
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`

