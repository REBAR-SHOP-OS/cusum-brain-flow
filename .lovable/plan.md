

# حذف Post Now و بهبود عملکرد Set Date و Schedule

## تغییرات — یک فایل: `src/components/social/PostReviewPanel.tsx`

### ۱. حذف دکمه "Post Now" از DateSchedulePopover
- دکمه "Post Now" (خطوط ۱۱۴-۱۲۳) کامل حذف می‌شود
- prop های `onPublishNow` و `publishing` از کامپوننت حذف می‌شوند
- دکمه "Set Date" تمام عرض را می‌گیرد

### ۲. بستن Popover بعد از Set Date
- الان وقتی Set Date زده می‌شود تاریخ ذخیره می‌شود ولی popover باز می‌ماند
- با اضافه کردن state برای کنترل open/close، بعد از Set Date پاپاور بسته شود

### ۳. Schedule — بدون تغییر
- منطق Schedule در فوتر از قبل درست کار می‌کند: تاریخ و پلتفرم و صفحه‌ها را می‌خواند و برای هر ترکیب یک رکورد scheduled ایجاد می‌کند
- cron job موجود (`social-cron-publish`) هر دقیقه چک می‌کند و پست‌های scheduled که زمانشان رسیده را publish می‌کند

### خلاصه تغییرات کد
1. حذف `onPublishNow` و `publishing` از `DateSchedulePopover`
2. حذف دکمه "Post Now" از JSX
3. اضافه کردن state `datePopoverOpen` برای بستن popover بعد از Set Date
4. دکمه "Set Date" بعد از ذخیره تاریخ، popover را ببندد

