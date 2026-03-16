
مشکل را دوباره بررسی کردم.

Do I know what the issue is? Yes.

## مشکل واقعی چیست
این خطا فقط یک باگ ساده در دکمه Publish نیست؛ دو ریشه دارد:

1. `PostReviewPanel` بعد از اینکه پلتفرم پست از `unassigned` به `instagram` آپدیت می‌شود، همیشه state محلی را از داده جدید sync نمی‌کند.  
   یعنی رکورد ممکن است آپدیت شده باشد، اما پنل هنوز `unassigned` نشان می‌دهد و همان را برای Publish بررسی می‌کند.

2. مسیر Publish اصلاً story را به‌صورت واقعی story منتشر نمی‌کند.  
   در حال حاضر:
   - فرانت `content_type` را به publish API نمی‌فرستد
   - بک‌اند در `social-publish` فقط:
     - تصویر را feed post
     - ویدئو را reel
     در نظر می‌گیرد
   - برای Instagram Story باید `media_type: "STORIES"` استفاده شود

بنابراین حتی اگر خطای `unassigned` را موقتاً دور بزنیم، انتشار story هنوز ریشه‌ای کامل نشده است.

## فایل‌هایی که باید اصلاح شوند
- `src/components/social/PostReviewPanel.tsx`
- `src/hooks/usePublishPost.ts`
- `supabase/functions/social-publish/index.ts`

## پلن اصلاح ریشه‌ای

### 1) Sync واقعی state پنل با پست
در `PostReviewPanel` وابستگی sync محلی فقط روی `post.id` نباشد.  
باید با تغییر این‌ها هم state تازه شود:
- `post.platform`
- `post.page_name`
- `post.content_type`

این باعث می‌شود اگر داستان بعد از generate به `instagram` تغییر کرد، UI فوراً همان را نشان بدهد و دیگر `unassigned` نماند.

### 2) Repair دفاعی قبل از Publish
در Publish Now اگر پست `story` باشد و platform هنوز `unassigned` باشد:
- ابتدا پلتفرم به `instagram` اصلاح شود
- state محلی هم همان لحظه آپدیت شود
- بعد ادامه Publish انجام شود

این بخش برای استوری‌های قدیمی یا رکوردهایی که قبل از fix ساخته شده‌اند هم لازم است.

### 3) ارسال `content_type` در مسیر Publish
در `usePublishPost` باید `content_type` هم همراه درخواست ارسال شود تا بک‌اند بداند این پست:
- post
- reel
- یا story

است.

### 4) پیاده‌سازی واقعی Story Publish در بک‌اند
در `social-publish`:
- schema ورودی `content_type` را بپذیرد
- در مسیر Instagram:
  - اگر `content_type === "story"` و فایل تصویر است: `media_type = "STORIES"`
  - اگر story و ویدئو است: story video flow هم با `STORIES`
  - کپشن برای story اجباری نباشد

این همان چیزی است که الان در سیستم کم است.

### 5) محدود کردن پلتفرم‌های نامعتبر برای Story
Story نباید مثل یک post عادی برای همه پلتفرم‌ها ارسال شود.  
برای این پروژه بهترین رفتار این است که:
- Story فقط روی Instagram (و گزینه‌های map‌شده به Instagram) publish شود
- اگر کاربر پلتفرم ناسازگار انتخاب کرده باشد، پیام واضح بگیرد

### 6) خطایابی بهتر
برای اینکه دوباره در حلقه خطا نمانیم:
- لاگ واضح برای `content_type`, `platform`, `resolvedPlatform`
- و پیام خطای جدا برای:
  - stale `unassigned`
  - unsupported story platform
  - Instagram Story API failure

## نتیجه بعد از اجرا
بعد از این اصلاح:
- پنل دیگر `unassigned` گیر نمی‌کند
- استوری‌های جدید و قدیمی قبل از Publish خودکار repair می‌شوند
- Publish Story واقعاً به‌صورت Story در Instagram انجام می‌شود، نه feed post عادی

## نکته فنی
این مشکل نیاز به تغییر دیتابیس ندارد؛ فقط باید مسیر UI state + publish request + backend publish logic یکپارچه شود.
