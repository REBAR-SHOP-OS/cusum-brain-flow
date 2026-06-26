## ریشه‌ی ارور

این تست شد و معلوم شد ارور هنوز هر چند دقیقه ظاهر می‌شه چون **سه لایه‌ای** که قبلاً ساختیم در محیط preview واقعاً جلوی ارور رو نگرفتن. علت دقیق:

### 1) چرا اصلاً ارور صادر می‌شه
- مرورگر شما یک ثبت قدیمی ServiceWorker روی `/sw.js` برای دامنه preview داره (از یک بیلد قبلی).
- Chromium هر ~۳۰ ثانیه در پس‌زمینه `/sw.js` رو دوباره fetch می‌کنه تا اسکریپت SW رو آپدیت کنه.
- روی preview، `/sw.js` با **HTTP 302** به `lovable.dev/auth-bridge` redirect می‌شه.
- مشخصات SW اجازه‌ی redirect روی منبع اسکریپت رو نمی‌ده → `TypeError: Failed to update a ServiceWorker … script resource is behind a redirect`.

پس منبع، **یک SW ثبت‌شده‌ی قدیمی** هست که نمی‌میره.

### 2) چرا تلاش قبلی برای پاکسازی شکست خورد
`unregisterStaleAppSW()` در `src/lib/pwa/registerServiceWorker.ts` فقط یک بار در بوت صدا زده می‌شه و `registration.unregister()` رو فراخوانی می‌کنه. اما:
- وقتی SW داره client فعلی رو کنترل می‌کنه (`navigator.serviceWorker.controller != null`)، `unregister()` فقط رجیستری رو علامت‌دار می‌کنه — worker زنده می‌مونه و **چک‌های آپدیت پس‌زمینه ادامه پیدا می‌کنن** تا وقتی همه‌ی client های کنترل‌شده بسته بشن یا صفحه hard-reload بشه.
- تب preview باز می‌مونه → SW هیچ‌وقت کاملاً آزاد نمی‌شه → ارور هر ~30s تکرار می‌شه.

### 3) چرا تُست هنوز نشون داده می‌شه
- `installServiceWorkerErrorSuppressor()` در بیلد فعلی preview (هَش `index-hIw7CQEF.js`) **هنوز deploy نشده**؛ این فایل قبل از اضافه‌شدن suppressor بیلد شده. به همین خاطر `[GlobalErrorHandler] Unhandled rejection` لاگ می‌شه و سپس `toast.error("Something went wrong", ...)` نمایش داده می‌شه — این تُست از کد خودمونه نه از Lovable overlay.
- در preview، تا وقتی بیلد جدید سرو نشه، هر دو لایه (suppressor + لیست ignore در `useGlobalErrorHandler`) بی‌اثرن.

---

## رفع ریشه‌ای (additive، non-destructive)

### A. کنترل کنترل (Force-uncontrol) قبل از unregister
در `src/lib/pwa/registerServiceWorker.ts`، تابع `unregisterStaleAppSW` رو ارتقا بدیم:

1. اگر `navigator.serviceWorker.controller` وجود داره، یک پیام `{ type: "SKIP_WAITING" }` به `controller.postMessage` بفرستیم (بدون خطر چون legacy SW این پیام رو نمی‌فهمه و نادیده می‌گیره).
2. بعد همه‌ی registration ها رو unregister کنیم (همون منطق فعلی، با match گسترش‌یافته).
3. cacheها رو پاک کنیم (همین الان داره انجام می‌شه).
4. **مرحله‌ی جدید:** بعد از unregister، اگر `controller` هنوز null نشده، روی preview origin یک بار `location.reload()` ملایم بزنیم — فقط در شرایط:
   - host با `id-preview--` یا `preview--` شروع بشه
   - و در sessionStorage کلید `sw_cleanup_reloaded` ست نشده باشه (تا loop نشه)
   پس‌از reload، چون registration حذف شده، SW دیگه page رو کنترل نمی‌کنه و چک آپدیت متوقف می‌شه.

### B. حلقه‌ی نگه‌بان آپدیت آپدیت (Watchdog) — fallback
اگر کاربر reload رو نخواد یا blocked بشه، یک `setInterval` ساده (هر 60 ثانیه) که `getRegistrations()` رو بررسی می‌کنه و هر registration ای که scriptURL ش به `/sw.js` ختم می‌شه رو دوباره unregister می‌کنه. این تضمین می‌کنه حتی اگر یک reload کافی نباشه، در طول session پاک می‌شه.

### C. سخت‌سازی suppressor (دفاع در عمق)
در `src/lib/pwa/suppressServiceWorkerErrors.ts`:
- علاوه بر pattern های فعلی، اطمینان حاصل کنیم رشته‌ی Chromium جدید `with script ('...sw.js')` هم match می‌شه (الان `'/sw.js'` به‌تنهایی هست که در URL کامل match می‌کنه — یک تست واحد جدید اضافه می‌کنیم برای قفل کردن این رفتار).
- در `useGlobalErrorHandler.isIgnoredError`، الگوی `script resource is behind a redirect` در حال حاضر هست؛ تایید با تست.

### D. اعتبارسنجی
1. بعد از deploy: باز کردن preview → DevTools → Application → Service Workers → باید رجیستری `/sw.js` نباشه (پس از حداکثر یک reload خودکار).
2. console باید فقط یک‌بار `[sw-cleanup] reloaded to release controller` لاگ کنه (info-level) و دیگه ارور SW نباشه.
3. تست رگرسیون جدید `tests/regression/pwa/sw-cleanup-force-reload.test.ts`:
   - شبیه‌سازی `controller != null` + `getRegistrations()` با یک `/sw.js` worker
   - تأیید که `unregister` فراخوانی شده، sessionStorage flag ست شده، و `location.reload` صدا زده شده
   - تأیید که در فراخوانی دوم (بعد از reload) دیگه reload صدا نمی‌خوره (no loop)

---

## فایل‌های تغییر یافته (همگی additive)

1. `src/lib/pwa/registerServiceWorker.ts` — افزودن منطق force-uncontrol + reload-once + watchdog interval.
2. `src/lib/pwa/suppressServiceWorkerErrors.ts` — افزودن یک pattern صریح‌تر (بدون حذف موارد فعلی).
3. `tests/regression/pwa/sw-cleanup-force-reload.test.ts` — تست رگرسیون جدید.
4. `.lovable/plan.md` — به‌روزرسانی توضیح ریشه‌ای.

## خارج از scope
- حذف `public/sw.js` (همچنان روی production مفیده).
- تغییر در Lovable preview auth-bridge redirect (تحت کنترل ما نیست).
- هیچ تغییری در business logic, schema, یا UI.

## نکته‌ی مهم برای کاربر
حتی بعد از merge این fix، **یک‌بار** ارور ممکنه دوباره ظاهر بشه چون reload خودکار قبل از suppressor شدن تب فعلی اجرا می‌شه. از reload بعد، کاملاً پاک می‌شه و دیگه برنمی‌گرده.
