

## بهبود جریان بازخورد: دیالوگ بررسی بازخورد

### مشکل فعلی
وقتی یک نوتیفیکیشن بازخورد (feedback_resolved) می‌آید، فقط دو آیکون کوچک (تیک سبز و چرخش قرمز) نشان داده می‌شود. کاربر نمی‌تواند جزئیات را ببیند و هنگام رد کردن نمی‌تواند نظر جدید اضافه کند.

### راه‌حل
یک دیالوگ (Dialog) جدید ایجاد می‌شود که وقتی کاربران دامنه `@rebar.shop` روی نوتیفیکیشن بازخورد کلیک می‌کنند، باز شود.

### تغییرات

#### 1. کامپوننت جدید: `FeedbackReviewDialog.tsx`

یک دیالوگ با محتوای زیر:
- **عنوان اصلی بازخورد** از metadata
- **اسکرین‌شات اصلی** (اگر `original_attachment_url` موجود باشد) به صورت تصویر نمایش داده شود
- **توضیحات اصلی** بازخورد
- **دکمه تایید** (سبز): مشکل برطرف شده - نوتیفیکیشن dismiss می‌شود
- **بخش رد**: یک textarea برای نوشتن نظر جدید کاربر + دکمه ارسال (قرمز)
- هنگام رد: تسک جدید با source `screenshot_feedback` و اولویت بالا به Radin ارسال می‌شود، همراه با نظر جدید کاربر

#### 2. تغییر در `InboxPanel.tsx`

- وقتی کاربر `@rebar.shop` است و نوتیفیکیشن `feedback_resolved` دارد، کلیک روی آن به جای باز/بسته کردن expanded، دیالوگ بررسی بازخورد را باز کند
- State جدید برای نگهداری آیتم انتخاب‌شده جهت بررسی
- آیکون‌های inline (CheckCircle و RotateCcw) همچنان باقی می‌مانند برای دسترسی سریع

---

### جزئیات فنی

**فایل جدید**: `src/components/feedback/FeedbackReviewDialog.tsx`

```text
+------------------------------------------+
|  Review Feedback                     [X]  |
|------------------------------------------|
|  Title: [original feedback title]         |
|                                           |
|  [Screenshot image if available]          |
|                                           |
|  Description: [original description]      |
|                                           |
|  [Confirm Fixed - green button]           |
|                                           |
|  --- Or reject with comment ---           |
|  [Textarea: your comment...]              |
|  [Re-Report Issue - red button]           |
+------------------------------------------+
```

**Props:**
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `item: Notification | null`
- `onConfirm: (id: string) => void`
- `onReReport: (item: Notification, comment: string) => void`

**تغییرات `InboxPanel.tsx`:**
- اضافه کردن state: `reviewItem` برای نگهداری آیتم فیدبک
- تغییر `handleToggle`: اگر `isFeedbackResolved` و کاربر `@rebar.shop` باشد، `reviewItem` را ست کند
- تغییر `handleReReport`: پارامتر comment جدید اضافه شود و در `description` تسک جدید قرار بگیرد با فرمت: `"نظر جدید: [comment]\n\nتوضیحات اصلی: [original_description]"`
- رندر `FeedbackReviewDialog` در انتهای کامپوننت

**بدون تغییر دیتابیس** - همه چیز از ساختار فعلی `tasks` و `notifications` استفاده می‌کند.
