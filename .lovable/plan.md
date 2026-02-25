

## آپلود چند فایل در Pixel Brain + الزام استفاده از Brain در تولید محتوا

### بخش ۱: آپلود چندین فایل همزمان

#### فایل: `src/components/brain/AddKnowledgeDialog.tsx`

1. **تبدیل `uploadedFile` از تک‌فایل به آرایه**: `uploadedFiles: { name, url, path }[]`
2. **اضافه کردن `multiple` به input فایل**: `<input multiple ...>`
3. **آپلود حلقه‌ای**: در `handleFileUpload`، تمام فایل‌های انتخاب شده را یکی‌یکی آپلود و به آرایه اضافه کن
4. **نمایش لیست فایل‌ها**: به جای نمایش یک فایل، لیستی از فایل‌های آپلود شده نمایش داده شود با دکمه حذف برای هرکدام
5. **حذف تکی**: تابع `removeFile(index)` برای حذف یک فایل خاص از آرایه
6. **ذخیره‌سازی**: در `handleSave`، برای هر فایل آپلود شده یک رکورد knowledge جداگانه ایجاد شود (هرکدام با عنوان فایل و metadata خودش)
7. **اگر فقط یک فایل باشد**: رفتار فعلی حفظ شود (title از نام فایل پر شود)
8. **اگر چند فایل باشد**: title اختیاری شود و هر فایل با نام خودش ذخیره شود

### بخش ۲: الزام استفاده از Brain در تولید محتوا (قاعده الزام‌آور)

#### فایل: `supabase/functions/ai-agent/index.ts`

در تابع `generateDynamicContent` تغییرات زیر اعمال می‌شود:

1. **پارامتر جدید**: `brainContext: string` اضافه شود به تابع
2. **تزریق Brain به prompt**: اگر `brainContext` خالی نباشد، بلوک زیر به prompt اضافه شود:

```text
## MANDATORY BRAIN CONTEXT (YOU MUST USE THIS):
{brainContext}

CRITICAL: You MUST incorporate the above brain context (custom instructions, brand resources, uploaded files/images) 
into your generated content. This is NOT optional. Align tone, style, language, and references with the brain data.
```

3. **محل فراخوانی**: در بخش Pixel Step 2 (خط ~537)، قبل از فراخوانی `generateDynamicContent`، متغیر `mergedContext.brainKnowledgeBlock` (که قبلاً توسط `agentContext.ts` ساخته شده) به تابع پاس داده شود:

```text
const dynContent = await generateDynamicContent(slot, isRegenerate, mergedContext.brainKnowledgeBlock || "");
```

4. **تزریق در image prompt هم**: اگر Brain شامل لینک تصاویر مرجع باشد، آن لینک‌ها به `imagePrompt` اضافه شوند تا Gemini هنگام تولید عکس از آن‌ها الهام بگیرد

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `src/components/brain/AddKnowledgeDialog.tsx` | پشتیبانی از آپلود چند فایل همزمان |
| `supabase/functions/ai-agent/index.ts` | تزریق الزامی Brain context به generateDynamicContent و imagePrompt |

### نتیجه
- کاربر می‌تواند چندین فایل (عکس، سند، ...) را یکجا در Brain آپلود کند
- هر بار که Pixel محتوا تولید می‌کند (کپشن + عکس)، الزاماً از اطلاعات Brain (دستورات سفارشی + فایل‌ها + منابع) استفاده می‌کند
