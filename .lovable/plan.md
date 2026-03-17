

## مشکل: نمایش مانیفست‌های خودکار "(Small)" در Detailed List

### ریشه مشکل
وقتی در Shop Floor یک مانیفست با اندازه‌های مختلف میلگرد (مثلاً 10M و 25M) به ماشین اختصاص داده می‌شود، سیستم به‌صورت خودکار آن را به دو بخش تقسیم می‌کند و یک مانیفست جدید با پسوند "(Small)" ایجاد می‌کند. این مانیفست‌ها فقط برای Shop Floor هستند و نباید در Detailed List نمایش داده شوند.

### راه‌حل
در `DetailedListView.tsx`، مانیفست‌هایی که نامشان با "(Small)" تمام می‌شود را فیلتر کنیم.

### تغییرات

**`src/components/office/DetailedListView.tsx`**
- در بخش `useMemo` که `activePlans` و `completedPlans` را جدا می‌کند (خط ~18)، ابتدا پلن‌هایی که نامشان با `(Small)` تمام می‌شود فیلتر شوند
- فقط یک خط تغییر: `plans` → `plans.filter(p => !p.name.endsWith("(Small)"))`

### فایل‌ها
- `src/components/office/DetailedListView.tsx`

