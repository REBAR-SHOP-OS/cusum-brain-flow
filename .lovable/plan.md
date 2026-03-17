

## افزودن توضیحات کامل‌تر به تقویم رویدادها

### مشکل فعلی
توضیحات فارسی در popover هر رویداد فقط یک خط کوتاه است و اطلاعات کافی به کاربر نمی‌دهد.

### راه‌حل
1. **توضیحات انگلیسی مفصل** به `CalendarEvent` اضافه شود (فیلد `description`) — 2-3 جمله درباره تاریخچه، اهمیت و ارتباط با صنعت
2. **توضیحات فارسی را گسترش دهیم** — هر ورودی `PERSIAN_EVENT_INFO` از یک خط به 2-3 خط افزایش یابد
3. **Popover را بزرگ‌تر و ساختارمندتر کنیم** — نمایش هم توضیح انگلیسی و هم فارسی با ساختار بهتر

### تغییرات

**`src/components/social/contentStrategyData.ts`**
- افزودن فیلد `description: string` به `CalendarEvent` interface
- برای هر رویداد، یک توضیح 2-3 جمله‌ای انگلیسی اضافه شود (تاریخچه، اهمیت، چرا مربوط به صنعت ساخت‌وساز است)

**`src/components/social/ContentStrategyPanel.tsx`**
- `PERSIAN_EVENT_INFO` را به ساختار object با فیلدهای `summary` (خلاصه فارسی) و `details` (توضیح کامل فارسی 2-3 جمله) تبدیل کنیم
- در `EventCard` popover:
  - عرض از `w-72` به `w-80` افزایش
  - نمایش `event.description` (انگلیسی) در بالا
  - نمایش hashtag‌ها
  - خط جداکننده
  - توضیح فارسی کامل در پایین
  - اضافه کردن آیکون‌های کوچک برای بخش‌ها (📖 Background، 🏗️ Industry Relevance)

### فایل‌ها
- `src/components/social/contentStrategyData.ts` — افزودن `description` به interface و داده‌ها
- `src/components/social/ContentStrategyPanel.tsx` — گسترش `PERSIAN_EVENT_INFO` و بازطراحی popover

