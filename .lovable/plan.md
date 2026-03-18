
## Fix: کارت علامت سؤال باید بعد از Schedule کاملا حذف شود

### چیزی که پیدا کردم
این مشکل فقط ظاهری نیست؛ واقعا رکوردهای `unassigned` داخل دیتابیس باقی مانده‌اند.

- در دیتابیس برای همین عنوان/تاریخ، هم کارت‌های `instagram` وجود دارد و هم 4 کارت `unassigned`
- در لاگ‌های بک‌اند، `schedule-post` چند بار با این ورودی صدا زده شده:
```text
platform=unassigned
delete_original=true
page=undefined
```
یعنی زمان Schedule، هنوز پلتفرم `unassigned` وارد جریان شده است.

### ریشه اصلی باگ
در `PostReviewPanel.tsx` دو ایراد کنار هم باعث این رفتار شده‌اند:

1. **پلتفرم hidden `unassigned` داخل state می‌ماند**
   - `localPlatforms` برای کارت علامت سؤال با `["unassigned"]` شروع می‌شود
   - در UI گزینه `unassigned` اصلا نمایش داده نمی‌شود
   - وقتی کاربر مثلا Instagram را انتخاب می‌کند، state عملا می‌تواند بشود:
     ```text
     ["unassigned", "instagram"]
     ```
   - بعد `handlePlatformsSaveMulti` آیتم اول را به عنوان پلتفرم اصلی ذخیره می‌کند، که همچنان `unassigned` می‌شود

2. **مسیر Schedule برخلاف Publish، `unassigned` را فیلتر نمی‌کند**
   - در Publish این فیلتر وجود دارد:
     ```text
     currentPlatforms.filter(p => p !== "unassigned")
     ```
   - اما در Schedule مستقیما از `localPlatforms` برای ساخت comboها استفاده می‌شود
   - نتیجه: برای هر page یک رکورد scheduled با `platform = unassigned` ساخته می‌شود

### چرا الان کارت سوالی هنوز مانده؟
چون رکورد اصلی شاید حذف شده باشد، اما قبلش چند **clone با `platform=unassigned`** ساخته شده‌اند؛ پس در تقویم هنوز گروه سوالی دیده می‌شود.

---

## برنامه اجرا

### 1) نرمال‌سازی انتخاب پلتفرم در `src/components/social/PostReviewPanel.tsx`
در هر جایی که state پلتفرم از روی پست مقداردهی می‌شود، `unassigned` را به عنوان انتخاب واقعی وارد UI نکنیم.

پیاده‌سازی:
- اگر `post.platform === "unassigned"`:
  - `localPlatforms` را خالی بگذاریم یا فقط پلتفرم‌های واقعی را نگه داریم
- در `handlePlatformsSaveMulti(values)`:
  - قبل از ذخیره، `values` را sanitize کنیم:
    ```text
    realPlatforms = values.filter(v => v !== "unassigned")
    ```
  - فقط `realPlatforms` را در state و update ذخیره کنیم
  - اگر خالی بود، خطا بدهیم یا Save را غیرفعال کنیم

### 2) اصلاح منطق Schedule در همان فایل
در دکمه Schedule، مثل Publish عمل کنیم:

- قبل از ساخت comboها:
  ```text
  schedulablePlatforms = localPlatforms.filter(p => p !== "unassigned")
  ```
- اگر خالی بود:
  - پیام خطا: «لطفا یک پلتفرم واقعی انتخاب کنید»
- فقط از `schedulablePlatforms` برای ساخت platform×page combo استفاده شود

این بخش جلوی تولید دوباره کارت‌های سوالی را می‌گیرد.

### 3) دفاع سمت بک‌اند در `supabase/functions/schedule-post/index.ts`
حتی اگر فرانت‌اند اشتباه کرد، بک‌اند نباید رکورد `unassigned` بسازد.

در unassigned flow:
- `extra_combos` را sanitize کنیم و هر combo با `platform = "unassigned"` را حذف کنیم
- اگر بعد از sanitize چیزی نماند، درخواست را reject کنیم
- فقط platformهای واقعی clone شوند

این باعث می‌شود باگ از سمت سرور هم بسته شود.

### 4) پاکسازی رکوردهای خراب قبلی
چون الان چند رکورد خراب از قبل ساخته شده‌اند، فقط fix کردن UI کافی نیست. باید داده‌های orphan هم پاک شوند.

یک پاکسازی هدفمند لازم است:
- حذف رکوردهای `social_posts` که:
  - `platform = 'unassigned'`
  - `status = 'scheduled'`
  - و برای همان `user_id + title + day (+ page_name)` یک sibling واقعی با پلتفرم غیر-`unassigned` وجود دارد

این cleanup فقط placeholderهای خراب را حذف می‌کند و به کارت‌های واقعی scheduled/published دست نمی‌زند.

### 5) اعتبارسنجی نهایی
بعد از پیاده‌سازی باید این سناریو تست شود:

```text
Question-mark post
→ select Instagram + pages + time
→ Schedule
Expected:
- فقط کارت‌های platform-specific بمانند
- هیچ کارت unassigned در همان title/day باقی نماند
```

### فایل‌هایی که باید تغییر کنند
- `src/components/social/PostReviewPanel.tsx`
- `supabase/functions/schedule-post/index.ts`
- یک migration برای cleanup داده‌های خراب فعلی

### نتیجه مورد انتظار
بعد از این اصلاح:
- انتخاب پلتفرم دیگر `unassigned` مخفی را با خودش حمل نمی‌کند
- Schedule دیگر clone سوالی نمی‌سازد
- کارت‌های سوالی خراب قبلی هم از تقویم حذف می‌شوند
- وقتی کاربر پلتفرم و page و ساعت را مشخص کرد، فقط همان کارت‌های واقعی باقی می‌مانند
