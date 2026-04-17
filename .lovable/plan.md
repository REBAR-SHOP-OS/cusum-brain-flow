
## درخواست کاربر
وقتی کاربر کپشن را دستی تغییر می‌دهد، همان متن باید حفظ و ذخیره شود. سیستم تحت هیچ شرایطی نباید خودش دوباره کپشن انگلیسی بنویسد یا متن کاربر را overwrite کند، مگر فقط با کلیک صریح روی `Regenerate caption`.

## ریشه‌ی مشکل
مشکل اصلی هنوز در `src/components/social/PostReviewPanel.tsx` باقی مانده:

1. **Auto-translate effect از منبع اشتباه برای save استفاده می‌کند**  
   در effect خطوط `262-304` ترجمه بر اساس `localContent` انجام می‌شود، اما هنگام ذخیره در DB این کد اجرا می‌شود:
   ```ts
   const rawContent = post.content || "";
   const baseContent = rawContent.includes("---PERSIAN---")
     ? rawContent.slice(0, rawContent.indexOf("---PERSIAN---")).trim()
     : rawContent;
   updatePost.mutate({ id: post.id, content: baseContent + persianBlock });
   ```
   یعنی به‌جای کپشن فعلیِ تایپ‌شده توسط کاربر، از `post.content` قدیمی استفاده می‌شود.  
   نتیجه: بعد از تایپ کاربر، mutation ترجمه می‌آید و کپشن قبلی را دوباره روی post می‌نویسد.

2. **Sync effect همان داده‌ی overwrite‌شده را دوباره داخل textarea می‌ریزد**  
   در effect خطوط `205-255`، هر بار `post.content` از query/realtime عوض شود، `localContent` دوباره از DB ست می‌شود.  
   پس وقتی auto-translate کپشن قدیمی را ذخیره کرد، textarea هم با همان متن قدیمی reset می‌شود و کاربر حس می‌کند سیستم خودش کپشن نوشته است.

3. **Upload / Regenerate image ظاهراً قبلاً درست شده‌اند**  
   در نسخه‌ی فعلی:
   - `handleMediaReady` دیگر caption regenerate نمی‌کند
   - `Regenerate image` هم با `image_only: true` صدا زده می‌شود  
   پس باگ فعلی از این دو مسیر نیست؛ از **auto-translate save path + resync path** است.

## برنامه‌ی اصلاح (Root-safe, Surgical)

### ۱. ساختن helper واحد برای editable caption
در `PostReviewPanel.tsx` یک helper کوچک اضافه شود:
```ts
function stripPersianBlock(content: string) {
  const idx = content.indexOf("---PERSIAN---");
  return idx === -1 ? content.trim() : content.slice(0, idx).trim();
}
```
این helper در همه‌ی مسیرها استفاده شود تا منبع caption همیشه یکدست باشد.

### ۲. اصلاح قطعی auto-translate save
در effect ترجمه:
- `baseContent` دیگر از `post.content` گرفته نشود
- فقط از **`localContent` فعلی کاربر** ساخته شود
- Persian block فقط append شود، بدون هیچ rewrite روی caption اصلی

منطق جدید:
```ts
const editableCaption = localContent.trim();
const contentToSave = editableCaption
  ? `${editableCaption}\n\n---PERSIAN---\n...`
  : `---PERSIAN---\n...`
```
یعنی:
- اگر کاربر کپشن نوشته، همان متن پایه می‌ماند
- اگر کپشن خالی است، سیستم هنوز هم caption انگلیسی تولید نمی‌کند

### ۳. حذف هر fallback که ممکن است caption بسازد
در effect ترجمه این خط:
```ts
const caption = localContent || localTitle || "";
```
به این تبدیل شود:
```ts
const caption = localContent.trim();
```
تا title هرگز به‌عنوان caption استفاده نشود.  
این با دستور کاربر هم‌راستا است: caption فقط یا دستی نوشته شود یا با regenerate صریح.

### ۴. مقاوم‌سازی sync از DB تا تایپ کاربر overwrite نشود
در sync effect مربوط به `post.content`:
- اگر همان post باز است و کاربر در حال edit دستی است، `localContent` فقط وقتی sync شود که مقدار جدید DB با آخرین save محلی هم‌خوان باشد
- یک ref مثل `lastSubmittedContentRef` یا `isDirtyRef` اضافه شود تا refresh/realtime نتواند متن در حال تایپ را بی‌دلیل overwrite کند

حداقل safeguard:
- هنگام `flushSave` آخرین editable caption ذخیره شود
- هنگام sync، اگر incoming content از آخرین submitted content عقب‌تر بود، روی textarea اعمال نشود

### ۵. یکپارچه‌سازی save pathها
هم `flushSave` و هم auto-translate از یک helper مشترک مثل `buildPostContent(editableCaption, persianImageText, persianCaptionText)` استفاده کنند تا:
- caption دستی همیشه source of truth بماند
- Persian block فقط metadata داخلی باشد
- اختلاف بین دو مسیر save از بین برود

### ۶. بدون تغییر در regenerate caption
دکمه‌ی `Regenerate caption` همان‌طور که هست مجاز باقی بماند، چون explicit user action است.  
اما فقط همان دکمه اجازه‌ی نوشتن caption جدید را داشته باشد.

## فایل‌های تغییرکننده
- `src/components/social/PostReviewPanel.tsx`

## آنچه دست‌نخورده می‌ماند
- `regenerate-post` edge function
- upload media behavior
- `image_only` regenerate image behavior
- Persian translation feature به‌عنوان reference داخلی
- DB schema / RLS / سایر ماژول‌ها

## نتیجه‌ی مورد انتظار
1. کاربر هر متنی در Caption بنویسد، همان متن حفظ و save می‌شود
2. Auto-translate فقط Persian block را به‌روزرسانی می‌کند، نه caption انگلیسی را
3. Title دیگر هرگز به‌صورت خودکار به caption تبدیل نمی‌شود
4. Realtime/query refresh دیگر متن در حال تایپ کاربر را overwrite نمی‌کند
5. سیستم فقط با کلیک صریح روی `Regenerate caption` مجاز به تولید caption است
