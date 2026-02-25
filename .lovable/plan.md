

## تغییر ابعاد تمام تصاویر به 1:1 (مربع) مناسب اینستاگرام

### مشکل فعلی
- تمام 5 اسلات Pixel در prompt خود عبارت `"16:9 aspect ratio"` دارند — خروجی مستطیل و نامناسب اینستاگرام
- پنل "Social media post" تصویر را با نسبت `4:3` نمایش می‌دهد (نه مربع)
- دیالوگ Image Generator پیش‌فرض سایز `1536x1024` دارد (مستطیل)

### تغییرات

#### 1. اصلاح prompt هر 5 اسلات (فایل: `supabase/functions/ai-agent/index.ts`)
- در `imagePrompt` هر 5 اسلات PIXEL_SLOTS، عبارت `"16:9 aspect ratio"` به `"1:1 square aspect ratio, perfect for Instagram"` تغییر می‌کند

#### 2. اصلاح نمایش تصویر در پنل Social media post (فایل: `src/components/social/PostReviewPanel.tsx`)
- خط 212: `aspect-[4/3]` به `aspect-square` تغییر می‌کند

#### 3. اصلاح پیش‌فرض Image Generator Dialog (فایل: `src/components/social/ImageGeneratorDialog.tsx`)
- پیش‌فرض سایز از `1536x1024` به `1024x1024` (مربع) تغییر می‌کند

#### 4. اصلاح پیش‌فرض edge function generate-image (فایل: `supabase/functions/generate-image/index.ts`)
- سایز پیش‌فرض gpt-image-1 از `1536x1024` به `1024x1024`
- سایز پیش‌فرض dall-e-3 از `1792x1024` به `1024x1024`

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `supabase/functions/ai-agent/index.ts` | اصلاح 5 عدد imagePrompt: 16:9 → 1:1 square |
| `src/components/social/PostReviewPanel.tsx` | aspect-[4/3] → aspect-square |
| `src/components/social/ImageGeneratorDialog.tsx` | پیش‌فرض سایز → 1024x1024 |
| `supabase/functions/generate-image/index.ts` | پیش‌فرض سایز → 1024x1024 |

### نکته
- کارت پست در چت (`PixelPostCard`) از قبل `aspect-square` دارد و نیاز به تغییر ندارد
