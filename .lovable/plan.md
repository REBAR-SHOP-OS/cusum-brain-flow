

# Screenshot: فریز فوری صفحه هنگام کلیک

## مشکل
وقتی دکمه اسکرین‌شات زده می‌شود، html2canvas زمان می‌برد (۱-۳ ثانیه). در این مدت ارورها یا حالت‌های موقت ممکن است ناپدید شوند و اسکرین‌شات وضعیت اصلی را نشان ندهد.

## راه‌حل

### `src/components/feedback/ScreenshotFeedbackButton.tsx`

۱. **فریز فوری**: بلافاصله پس از کلیک (قبل از شروع html2canvas):
   - یک `<div>` تمام‌صفحه با `position: fixed; inset: 0; z-index: 9998` اضافه شود که تمام تعاملات را مسدود کند
   - یک `<style>` تزریق شود: `* { animation-play-state: paused !important; transition: none !important; }` تا انیمیشن‌ها متوقف شوند
   - `document.body.style.pointerEvents = 'none'` برای جلوگیری از hover effects

۲. **رفع فریز**: بعد از اتمام capture (چه موفق چه ناموفق) در `finally` block، overlay و style حذف شوند

۳. **ترتیب اجرا**:
```text
کلیک → فریز فوری (sync) → capture async → نتیجه → رفع فریز → نمایش overlay
```

تغییرات فقط در تابع `capture` در همین فایل — حدود ۱۰ خط اضافه شدن در ابتدا و ۳ خط در `finally`.

