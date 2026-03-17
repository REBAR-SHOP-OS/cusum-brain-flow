

## مشکل: حذف تصادفی کارت‌های اسکجول شده

### ریشه مشکل — ۳ نقطه خطرناک پیدا شد:

**1. `handleDelete` در `PostReviewPanel.tsx` (خط 307-322) — بزرگترین مشکل**
وقتی یک کارت حذف می‌شود، تمام پست‌هایی که `title` یا `image_url` یکسان دارند هم حذف می‌شوند. این یعنی حذف یک draft باعث حذف کارت‌های scheduled هم‌نام می‌شود.

**2. `handleBulkDelete` در `SocialMediaManager.tsx` (خط 156-180) — همان مشکل**
Bulk delete هم سیبلینگ‌ها را بر اساس title/image_url پیدا و حذف می‌کند — بدون بررسی status.

**3. Sibling cleanup در `schedule-post/index.ts` (خط 103-120)**
هنگام اسکجول کردن یک پست unassigned، تمام پست‌های unassigned با همان title در همان روز حذف می‌شوند. اگر چند unassigned با title مشابه وجود داشته باشند، همه از بین می‌روند.

### راه حل

**فایل 1: `src/components/social/PostReviewPanel.tsx`**
- `handleDelete` فقط پست فعلی را حذف کند (نه سیبلینگ‌ها)
- اگر batch delete لازم است، فقط پست‌هایی با status `draft` یا `declined` را شامل شود
- پست‌های `scheduled` و `published` هرگز به صورت خودکار حذف نشوند

**فایل 2: `src/pages/SocialMediaManager.tsx`**
- `handleBulkDelete` از حذف سیبلینگ‌های scheduled محافظت کند
- فقط پست‌هایی که خود کاربر انتخاب کرده حذف شوند (بدون expand خودکار به سیبلینگ‌ها)
- یا حداقل سیبلینگ‌هایی که `status === "scheduled"` یا `"published"` دارند exclude شوند

**فایل 3: `supabase/functions/schedule-post/index.ts`**
- Sibling cleanup (خط 103-120) فقط unassigned هایی را حذف کند که `status = "draft"` هستند
- یک guard اضافه شود: هرگز پستی با `status = "scheduled"` یا `"published"` حذف نشود

### خلاصه تغییرات
- حذف تکی: فقط همان پست، نه سیبلینگ‌ها
- حذف دسته‌ای: فقط پست‌های انتخاب‌شده توسط کاربر
- Sibling cleanup: فقط draft/unassigned، نه scheduled
- Guard کلی: پست‌های scheduled/published از هر نوع حذف خودکار محافظت شوند

