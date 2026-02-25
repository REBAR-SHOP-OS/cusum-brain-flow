

## اضافه کردن تقویم و گزینه "Post Now" به بخش Publish Date

### مشکل فعلی
آیکون تقویم در بخش "Publish date" فقط نمایشی است و هیچ عملکردی ندارد. کاربر نمی‌تواند تاریخ را تغییر دهد یا پست را فوری ارسال کند.

### راه‌حل

#### فایل: `src/components/social/PostReviewPanel.tsx`

1. **تبدیل بخش Publish date به یک Popover** با تقویم داخلی:
   - وقتی کاربر روی آیکون تقویم یا بخش تاریخ کلیک کند، یک Popover باز شود
   - داخل Popover:
     - کامپوننت `Calendar` (از `react-day-picker`) برای انتخاب تاریخ
     - فیلد ساعت و دقیقه برای تنظیم زمان دقیق
     - دکمه **"Post Now"** برای ارسال فوری پست (بدون زمان‌بندی)
     - دکمه **"Set Date"** برای تایید تاریخ انتخاب شده

2. **عملکرد "Post Now":**
   - تاریخ را به همین لحظه (`new Date()`) تنظیم می‌کند
   - پست را مستقیماً publish می‌کند (مثل دکمه Publish فعلی)

3. **عملکرد "Set Date":**
   - تاریخ انتخاب شده + ساعت را ذخیره می‌کند
   - وضعیت پست را آپدیت می‌کند

4. **Import‌های جدید:**
   - `Popover`, `PopoverTrigger`, `PopoverContent` از `@/components/ui/popover`
   - `Calendar` از `@/components/ui/calendar`

### ساختار UI داخل Popover

```text
+---------------------------+
|       [  Calendar  ]      |
|                           |
|  Time: [HH] : [MM]  AM/PM|
|                           |
|  [Post Now]  [Set Date]   |
+---------------------------+
```

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `src/components/social/PostReviewPanel.tsx` | اضافه کردن Popover با Calendar + Time picker + دکمه Post Now |

