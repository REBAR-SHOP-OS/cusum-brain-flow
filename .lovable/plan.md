

# Plan: اضافه کردن دسترسی Publish Now برای zahra@rebar.shop

## تغییر
یک تغییر ساده در فایل `src/components/social/PostReviewPanel.tsx` خط 139:

**قبل:**
```typescript
const canPublish = user?.email === "radin@rebar.shop";
```

**بعد:**
```typescript
const canPublish = user?.email === "radin@rebar.shop" || user?.email === "zahra@rebar.shop";
```

این تغییر به zahra اجازه می‌دهد بدون نیاز به تایید نیل، مستقیماً از دکمه Publish Now استفاده کند.

