
# حذف ستون سمت راست (Post View Panel) از ایجنت Pixel

## خلاصه
ستون سمت راست ایجنت Pixel که برای نمایش و ویرایش پست‌ها استفاده می‌شود، به‌طور کامل حذف خواهد شد.

## تغییرات

### 1. فایل `src/pages/AgentWorkspace.tsx`
- حذف import مربوط به `PixelPostViewPanel` و `PixelPostData`
- حذف state مربوط به `viewingPost` و `setViewingPost`
- حذف بلوک JSX ستون سمت راست (خطوط 465-470)
- حذف prop مربوط به `onViewPost` از `ChatThread`

### 2. فایل‌هایی که بدون تغییر می‌مانند (فعلا حذف نمی‌شوند)
فایل‌های زیر در پروژه باقی می‌مانند ولی دیگر استفاده نمی‌شوند:
- `src/components/social/PixelPostViewPanel.tsx`
- `src/components/social/PixelPostCard.tsx`
- `src/components/social/PixelChatRenderer.tsx`

اگر بعدا خواستید این فایل‌ها هم حذف شوند، اعلام کنید.

## نتیجه
فضای چت Pixel تمام عرض موجود را اشغال می‌کند و دیگر پنل سمت راستی وجود نخواهد داشت.
