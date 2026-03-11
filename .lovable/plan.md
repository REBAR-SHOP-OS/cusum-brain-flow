

## ایجاد کارت‌های مجزا برای هر اکانت هنگام Approve در ایجنت پیکسل

### مشکل فعلی
وقتی در ایجنت پیکسل روی "Approve" کلیک می‌شود، فقط **یک ردیف** در `social_posts` ساخته می‌شود (پلتفرم: instagram، بدون page_name). در حالی که انتظار می‌رود برای هر اکانت/پیج یک کارت مجزا ساخته شود.

### تغییر

**`src/pages/AgentWorkspace.tsx`** — آپدیت `handleApprovePost`:

به جای یک `insert` تکی، از لیست `PLATFORM_PAGES` (که در `PostReviewPanel.tsx` تعریف شده) استفاده کرده و برای **هر پلتفرم × هر پیج** یک ردیف جداگانه در دیتابیس بسازد.

منطق جدید:
```typescript
// پلتفرم‌های پیش‌فرض برای Pixel approve
const DEFAULT_PLATFORMS = ["facebook", "instagram"];

// برای هر پلتفرم، تمام پیج‌ها
const rows = [];
for (const platform of DEFAULT_PLATFORMS) {
  const pages = PLATFORM_PAGES[platform] || [];
  for (const page of pages) {
    rows.push({
      platform,
      status: "draft",
      title,
      content,
      image_url: post.imageUrl || null,
      hashtags,
      scheduled_date: scheduledDate.toISOString(),
      user_id: user.id,
      page_name: page.value,
    });
  }
}
await supabase.from("social_posts").insert(rows);
```

این تغییر باعث می‌شود هنگام Approve در پیکسل، مثلاً ۶ کارت فیسبوک + ۶ کارت اینستاگرام = ۱۲ ردیف مجزا ساخته شود و هر کدام در تقویم قابل مشاهده و مدیریت باشند.

همچنین `PLATFORM_PAGES` را از `PostReviewPanel.tsx` به یک فایل مشترک (`src/lib/socialConstants.ts`) منتقل می‌کنم تا هر دو فایل از یک منبع استفاده کنند.

