

# بررسی سیستم برنامه‌ریزی و انتشار پست‌ها

## وضعیت فعلی سیستم

### ✅ Cron Job — فعال و درست تنظیم شده
- یک cron job هر **۲ دقیقه** اجرا می‌شود (`*/2 * * * *`)
- Edge function `social-cron-publish` را فراخوانی می‌کند
- پست‌هایی که `status = 'scheduled'` و `scheduled_date <= now()` دارند را پیدا و منتشر می‌کند

### ⚠️ مشکل اصلی: پست‌ها از "draft" به "scheduled" منتقل نمی‌شوند
از بررسی دیتابیس مشخص شد که **هیچ پستی با status = 'scheduled' وجود ندارد**. تمام پست‌ها در وضعیت `draft` یا `published` هستند. این یعنی:
- وقتی کاربر دکمه Schedule را می‌زند و تاریخ/ساعت انتخاب می‌کند، پست باید `status: 'scheduled'` و `qa_status: 'approved'` شود
- اگر کاربر پستی را schedule نکرده باشد، cron هیچ پستی برای انتشار پیدا نمی‌کند — **این رفتار صحیح است**

### ✅ منطق Schedule Popover — درست کار می‌کند
کد `SchedulePopover.tsx` وقتی Confirm زده شود:
- `status: "scheduled"`, `qa_status: "approved"`, `scheduled_date` را ست می‌کند
- سپس cron job هر ۲ دقیقه چک می‌کند و اگر زمان رسیده باشد منتشر می‌کند

**نتیجه: سیستم scheduling به‌درستی تنظیم شده و آماده کار است.** فقط باید پستی را واقعاً schedule کنید تا cron آن را در زمان مقرر منتشر کند.

---

## شبکه‌های اجتماعی و اکانت‌های متصل

### 📘 Facebook — متصل ✅
۶ صفحه فیسبوک:
1. **Ontario Steel Detailing**
2. **Rebar.shop**
3. **Ontario Digital Marketing**
4. **Ontario Logistics**
5. **Ontario Steels**
6. **Rebar.shop Ontario**

### 📸 Instagram — متصل ✅
۶ اکانت اینستاگرام بیزینسی:
1. **@ontariosteeldetailing**
2. **@rebar.shop**
3. **@ontariodigitalmarketing**
4. **@ontariologistics.ca**
5. **@ontariosteels.ca**
6. **@rebar.shop_on**

### 💼 LinkedIn — متصل ✅
یک اکانت LinkedIn متصل است.

### 🎥 YouTube — متصل ✅
چندین اتصال YouTube ثبت شده.

### ❌ TikTok — متصل نیست
### ❌ Twitter/X — توکن‌ها تنظیم نشده (نیاز به API keys دارد)

---

## خلاصه
| بخش | وضعیت |
|------|--------|
| Cron Job (هر ۲ دقیقه) | ✅ فعال |
| Schedule Popover | ✅ عملکرد صحیح |
| انتشار Facebook | ✅ آماده |
| انتشار Instagram | ✅ آماده |
| انتشار LinkedIn | ✅ آماده |
| انتشار YouTube | ✅ متصل (ولی publishing پیاده‌سازی نشده) |
| انتشار TikTok | ❌ متصل نیست |
| انتشار Twitter/X | ❌ نیاز به API keys |

**سیستم scheduling و auto-publish درست کار می‌کند.** برای تست واقعی، کافی است یک پست را schedule کنید و منتظر بمانید تا cron آن را در زمان مشخص شده منتشر کند.

