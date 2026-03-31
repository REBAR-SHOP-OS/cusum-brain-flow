

# حذف پلتفرم‌های "Instagram (FB Pages)" و "LinkedIn (Organization)"

## خلاصه
حذف کامل دو پلتفرم `instagram_fb` و `linkedin_org` از سیستم. این دو فقط در ۲ فایل وجود دارند.

## تغییرات

### 1. `src/lib/socialConstants.ts`
- حذف کلیدهای `instagram_fb` و `linkedin_org` از آبجکت `PLATFORM_PAGES`

### 2. `src/components/social/PostReviewPanel.tsx`
- حذف `instagram_fb` و `linkedin_org` از آرایه `PLATFORM_OPTIONS` (خطوط 52، 54)
- حذف `instagram_fb` از چک `hasFb` (خط 187)
- حذف `instagram_fb` و `linkedin_org` از `platformIconMap` (خطوط 389، 391)

هیچ فایل دیگری تحت تأثیر قرار نمی‌گیرد.

