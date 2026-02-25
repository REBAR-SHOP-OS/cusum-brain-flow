
## اضافه کردن دیالوگ بررسی فیدبک برای آیتم‌های To-do

### مشکل
آیتم‌های To-do مربوط به فیدبک (مثل "Approve & Close: Feedback:...") وقتی کلیک می‌شوند، کاربر را به صفحه `/tasks` منتقل می‌کنند. کاربر باید بتواند مستقیماً از اینباکس فیدبک را بررسی کند.

### راه‌حل
وقتی کاربر روی یک To-do فیدبکی کلیک می‌کند، اطلاعات تسک مرتبط از دیتابیس خوانده شده و دیالوگ FeedbackReviewDialog باز می‌شود. کاربر می‌تواند:
1. **تأیید**: تسک به حالت completed تغییر کرده و نوتیفیکیشن حذف می‌شود
2. **رد با نظر**: تسک جدید با اولویت بالا برای Radin ساخته می‌شود

### تغییرات

**فایل: `src/components/panels/InboxPanel.tsx`**

1. در تابع `handleToggle`: شناسایی To-do آیتم‌های فیدبکی با بررسی `metadata.category === "task_approval"` و عنوان شامل "Feedback:"
2. وقتی شناسایی شد: با استفاده از `metadata.human_task_id` اطلاعات تسک (اسکرین‌شات، توضیحات) از جدول `tasks` خوانده می‌شود
3. ساخت یک آبجکت موقت با metadata مناسب برای FeedbackReviewDialog و باز کردن دیالوگ
4. در `handleConfirmFixed`: علاوه بر dismiss نوتیفیکیشن، تسک مرتبط نیز به حالت `completed` آپدیت شود
5. در `handleReReport`: تسک فعلی را completed کرده و تسک جدید برای Radin بسازد

### جزییات فنی

```text
کلیک روی To-do فیدبکی
  -> بررسی: metadata.category === "task_approval" && title شامل "Feedback:"
  -> بله: fetch task by human_task_id از جدول tasks
     -> ساخت reviewItem با metadata شامل:
        - original_title: task.title
        - original_description: task.description
        - original_attachment_url: task.attachment_url
        - human_task_id: task.id
     -> باز کردن FeedbackReviewDialog
  -> خیر: رفتار عادی (navigate یا expand)

تأیید:
  -> UPDATE tasks SET status='completed' WHERE id=human_task_id
  -> dismiss notification

رد:
  -> INSERT new task for Radin with comment
  -> UPDATE current task SET status='completed'
  -> dismiss notification
```

بدون تغییر دیتابیس. فقط تغییر در فایل InboxPanel.tsx.
