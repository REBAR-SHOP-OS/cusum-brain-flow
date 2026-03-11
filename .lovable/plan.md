

## دو مشکل و راه‌حل

### مشکل ۱: عکس نمایش داده نمی‌شود
بررسی دیتابیس نشان می‌دهد پست‌هایی که اخیراً از پیکسل تایید شده‌اند `image_url: null` دارند. این یعنی `post.imageUrl` به درستی به دیتابیس ارسال نشده. احتمالاً مشکل از پست‌های LinkedIn است که از مسیر دیگری (Auto-generate) ساخته شده‌اند، نه از Pixel approve. پست‌های Instagram که از Pixel approve ساخته شده‌اند عکس دارند.

### مشکل ۲: کارت باید بدون پلتفرم باشد
درخواست کاربر: وقتی در پیکسل Approve می‌شود، به جای ساخت ۱۲ کارت مجزا (۶ فیسبوک + ۶ اینستاگرام)، فقط **یک کارت بدون پلتفرم** ساخته شود. بعداً کاربر در Social Media Manager پلتفرم و پیج را مشخص می‌کند.

### تغییرات

**1. `src/pages/AgentWorkspace.tsx`** — آپدیت `handleApprovePost`:
- به جای حلقه روی `PIXEL_APPROVE_PLATFORMS × PLATFORM_PAGES`، فقط **یک ردیف** insert شود
- `platform` مقدار خالی یا یک مقدار خنثی مثل `"unassigned"` داشته باشد
- `page_name` خالی باشد
- `image_url` حتماً ارسال شود (مطمئن شویم `post.imageUrl` درست پاس داده می‌شود)

```typescript
const { error } = await supabase.from("social_posts").insert({
  platform: "unassigned",
  status: "draft",
  title,
  content,
  image_url: post.imageUrl || null,
  hashtags,
  scheduled_date: scheduledDate.toISOString(),
  user_id: user.id,
  page_name: null,
});
```

**2. `src/components/social/SocialCalendar.tsx`** — اضافه کردن آیکون برای `"unassigned"`:
- یک آیکون خنثی (مثلاً علامت سؤال یا دایره خاکستری) برای پلتفرم `unassigned` اضافه شود
- اضافه کردن `"unassigned"` به `PLATFORM_ORDER`

**3. `src/components/social/PostReviewPanel.tsx`** — اجازه انتخاب پلتفرم برای کارت‌های unassigned:
- وقتی پست `platform === "unassigned"` است، کاربر بتواند پلتفرم و پیج‌ها را انتخاب کند
- هنگام ذخیره، اگر چند پلتفرم/پیج انتخاب شده، کارت‌های مجزا ساخته شوند

**4. `src/hooks/useSocialPosts.ts`** — اضافه کردن `"unassigned"` به تایپ platform

