

## درخواست کاربر
وقتی کپشن را دستی می‌نویسد، سیستم حق ندارد خودش آن را regenerate کند یا overwrite نماید. کپشن باید **همیشه خالی** بماند مگر اینکه:
- کاربر خودش دستی تایپ کند، یا
- کاربر خودش روی دکمه‌ی **Regenerate caption** کلیک کند.

## ریشه‌ی مشکل (در `src/components/social/PostReviewPanel.tsx`)

دو auto-trigger در حال حاضر بدون اجازه کاربر کپشن را تغییر می‌دهند:

### A) خط 314-339 — `handleMediaReady` بعد از Upload Video
```ts
if (type === "video" && localContentType !== "story") {
  setRegeneratingCaption(true);
  // video-to-social → updatePost.mutate({ content: fullContent, title: ... })
  // fallback → regenerate-post caption_only:true
}
```
→ هر بار کاربر ویدئو آپلود می‌کند، کپشن **به‌اجبار** بازنویسی می‌شود حتی اگر کاربر از قبل چیزی نوشته باشد.

### B) خط 262-304 — Auto-translate effect
بعد از 1.5s از تایپ کاربر، `updatePost.mutate({ content: baseContent + persianBlock })` صدا زده می‌شود. این فقط بلاک Persian را append می‌کند (base content دست‌نخورده است) پس **کپشن انگلیسی را overwrite نمی‌کند**، ولی باید مطمئن شویم baseContent دقیقاً همان چیزی است که کاربر تایپ کرده — که همین الان هم هست. این OK است و دست‌نخورده می‌ماند.

### دکمه‌های explicit (OK — دست‌نخورده)
- `Regenerate caption` (خط 918-954) — کلیک صریح کاربر ← مجاز
- `Regenerate image` (خط 675-690) — `is_video` پاس می‌دهد ولی `caption_only` نه → edge function هم caption را تولید می‌کند. باید بررسی شود که این دکمه فقط "Regenerate image" نامیده شده ولی caption را هم تغییر می‌دهد. طبق اسم دکمه و توقع کاربر، این هم باید **فقط تصویر** را regenerate کند.

## برنامه (Surgical, Additive)

### ۱. حذف auto-regenerate کپشن بعد از upload
در `handleMediaReady` (خط 314-339):
- بلاک کامل `if (type === "video" && localContentType !== "story") { ... setRegeneratingCaption ... }` **حذف** شود.
- فقط media آپلود و به post متصل شود؛ کپشن دست‌نخورده باقی بماند.
- Toast ساده: `"Video attached"` — بدون mention کپشن.

### ۲. محدودسازی دکمه‌ی "Regenerate image"
خط 677: پارامتر صدا زدن `regenerate-post` را محدود کنیم:
```ts
await invokeEdgeFunction("regenerate-post", { 
  post_id: post.id, 
  is_video: !!isVideo,
  image_only: true,   // ← افزوده
}, { timeoutMs: 120000 });
```
و در edge function `regenerate-post/index.ts`، یک branch `image_only` اضافه شود که فقط تصویر جدید تولید و در `image_url` ذخیره کند — **هیچ تغییری در `title` / `content` / `hashtags`**. اگر edge function این قابلیت را ندارد، یک guard کوتاه اضافه شود که اگر `image_only:true` بود، در انتهای update فقط `image_url` را بنویسد.

Toast update: `"Image regenerated"` به‌جای `"New image and caption generated successfully."`.

### ۳. دکمه‌ی صریح "Regenerate caption" بدون تغییر
خط 918-954 همان‌طور که هست می‌ماند — این دکمه‌ی صریح کاربر است و مطابق قانون کاربر مجاز است.

### ۴. ضمانت auto-save فقط برای تایپ دستی
`flushSave` و `triggerDebouncedSave` (خط 367-397) فقط از onChange textarea صدا زده می‌شوند → این خودش فقط محتوای دستی کاربر را ذخیره می‌کند. دست‌نخورده.

### ۵. پاک شدن کپشن برای پست جدید (Optional — match user intent)
کاربر گفت: **"کپشن باید همیشه خالی باشد تا یا من به آن کپشن بنویسم یا ریجنریت کنم"**.

بررسی: generator 5-slot در `auto-generate-social` احتمالاً موقع ساخت placeholder پست، کپشن را از قبل پر می‌کند. این در scope این تغییر نیست و بدون دستور کاربر فعلاً دست نمی‌زنیم. فقط auto-overwrite های بعد از اقدامات کاربر حذف می‌شود.

اگر کاربر بخواهد روی کپشن‌های initial هم تأثیر بگذارد، در مرحله‌ی بعد آدرس می‌دهیم.

## فایل‌های تغییرکننده
- `src/components/social/PostReviewPanel.tsx` — حذف auto-caption regen در `handleMediaReady`، افزودن flag `image_only: true` به call regenerate image
- `supabase/functions/regenerate-post/index.ts` — پذیرش `image_only: true` و skip کردن به‌روزرسانی `title`/`content`/`hashtags` در آن branch

## آنچه دست‌نخورده می‌ماند
- Auto-translate به Persian (فقط append می‌کند، overwrite نمی‌کند)
- دکمه‌ی صریح `Regenerate caption` (با کلیک کاربر)
- Debounced auto-save تایپ دستی
- UI, DB, RLS, سایر edge functions
- زبان UI: انگلیسی

## نتیجه
1. ✅ آپلود Video / Image هرگز کپشن را عوض نمی‌کند
2. ✅ دکمه `Regenerate image` فقط تصویر را بازتولید می‌کند، نه کپشن
3. ✅ کپشن فقط وقتی تغییر می‌کند که کاربر خودش تایپ کند یا روی `Regenerate caption` کلیک کند
4. ✅ ترجمه‌ی فارسی و auto-save دست‌نخورده و عادی کار می‌کند

