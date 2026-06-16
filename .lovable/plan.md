
## مشکل
در `src/main.tsx`، `registerSW` بدون شرط روی هر محیطی (از جمله Lovable preview در iframe) صدا زده می‌شود. روی دامنه‌های `id-preview--*.lovable.app` فایل `/sw.js` از پشت یک redirect سرو می‌شود و مرورگر طبق spec اجازه ثبت SW پشت redirect را نمی‌دهد. نتیجه: TypeError مداوم و toast «Something went wrong — Failed to update a ServiceWorker for scope …» که کاربر در تصویر نشان داده.

ارور «Publishing Failed» جداست (توکن Meta باطل شده) و راه‌حلش فقط reconnect در Integrations است — نیازی به تغییر کد ندارد و در این پلن گنجانده نمی‌شود.

## تغییرات

### 1. فایل جدید: `src/lib/pwa/registerServiceWorker.ts`
یک wrapper امن طبق PWA skill پروژه. منطق:

- اگر هر یک از موارد زیر برقرار بود، **ثبت نکن** و هر `/sw.js` ثبت‌شده‌ی قبلی روی همان origin را unregister کن:
  - `!import.meta.env.PROD`
  - داخل iframe (`window.top !== window.self`)
  - hostname با `id-preview--` یا `preview--` شروع شود
  - hostname برابر `lovableproject.com` یا با `.lovableproject.com` ختم شود
  - hostname برابر `lovableproject-dev.com` یا با `.lovableproject-dev.com` ختم شود
  - hostname برابر `beta.lovable.dev` یا با `.beta.lovable.dev` ختم شود
  - URL فعلی شامل `?sw=off` (kill switch)
- در غیر این صورت `registerSW({...})` با همان رفتار فعلی (autoUpdate + interval 60s).
- خروجی: function (no-op در حالت‌های refused) تا main.tsx ساده بماند.

### 2. ویرایش: `src/main.tsx`
حذف فراخوانی مستقیم `registerSW` و جایگزینی با import از wrapper جدید:
```ts
import { registerServiceWorker } from "@/lib/pwa/registerServiceWorker";
registerServiceWorker();
```

### 3. هیچ تغییری در:
- `vite.config.ts` (تنظیمات VitePWA و `injectRegister: null` و `navigateFallbackDenylist` همگی صحیح‌اند)
- `src/lib/browserNotification.ts` (worker پوش `sw-push.js` جداست و طبق skill باید دست‌نخورده بماند)
- production build (روی `erp.rebar.shop` SW مثل قبل ثبت می‌شود)

### 4. Verification (طبق Post-Change Verification)
- preview را reload کن، در DevTools → Application → Service Workers تأیید کن که در preview هیچ SW ثبت نمی‌شود و toast دیگر نمی‌آید.
- console logs را با `code--read_console_logs` چک کن که `Failed to update a ServiceWorker` دیگر نباشد.

### 5. اقدام دستی کاربر برای ارور قرمز (خارج از کد)
**Integrations → Facebook/Instagram → Disconnect → Connect** و reconnect با scopeهای: `pages_show_list`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`. سپس Retry Publishing.

## فایل‌های لمس‌شده
- created: `src/lib/pwa/registerServiceWorker.ts`
- edited: `src/main.tsx`
