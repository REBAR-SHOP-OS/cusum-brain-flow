

# دکمه Regenerate Image — بازسازی خودکار تصویر و کپشن با یک کلیک

## خلاصه
دکمه "Regenerate image" در پنل بازبینی پست (`PostReviewPanel`) به جای باز کردن دیالوگ، با یک کلیک تصویر جدید تولید و کپشن مناسب بنویسد.

## تغییرات

### ۱. Edge Function جدید: `supabase/functions/regenerate-post/index.ts`
یک edge function جدید که:
- `post_id` دریافت می‌کند
- اطلاعات پست فعلی (platform, title, content) را از دیتابیس می‌خواند
- با Gemini Flash کپشن و عنوان جدید تولید می‌کند (+ image_prompt)
- با Lovable AI Gateway (`google/gemini-3-pro-image-preview`) تصویر جدید تولید و در `social-images` storage آپلود می‌کند
- پست را در دیتابیس با تصویر و کپشن جدید آپدیت می‌کند
- نتیجه نهایی (title, content, hashtags, image_url) را برمی‌گرداند

### ۲. فایل: `src/components/social/PostReviewPanel.tsx`
- اضافه کردن state: `regenerating` (boolean)
- دکمه "Regenerate image" → `onClick` فراخوانی `supabase.functions.invoke("regenerate-post", { body: { post_id } })`
- در حالت loading: آیکون spinner + متن "Regenerating..."
- پس از موفقیت: `queryClient.invalidateQueries` برای refresh پست
- پیام toast موفقیت/خطا

### ۳. فایل: `supabase/config.toml`
اضافه کردن تنظیمات function جدید با `verify_jwt = false`

## جزییات فنی Edge Function

```typescript
// regenerate-post/index.ts
// 1. Auth check
// 2. Fetch post from DB
// 3. AI call → new caption + image_prompt (Gemini Flash)
// 4. Image generation via Lovable AI Gateway (gemini-3-pro-image-preview)
// 5. Upload to social-images bucket
// 6. Update post in DB (title, content, hashtags, image_url)
// 7. Return updated post
```

## فایل‌ها
1. `supabase/functions/regenerate-post/index.ts` — edge function جدید
2. `src/components/social/PostReviewPanel.tsx` — اتصال دکمه به edge function
3. `supabase/config.toml` — ثبت function جدید

