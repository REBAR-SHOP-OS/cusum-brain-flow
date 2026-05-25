# Plan

## Goal
رفع خطای پابلیش اینستاگرام که هنوز هم پست را منتشر نمی‌کند و به‌اشتباه پیام reconnect نشان می‌دهد.

## Root cause found
- فایل مشترک `supabase/functions/_shared/instagramPublish.ts` الان این منطق را دارد:
  - هر خطایی که `type` آن شامل `OAuth` باشد را خطای auth حساب می‌کند.
- اما خطای فعلی Meta این است:
  - `code: 9007`
  - `error_subcode: 2207027`
  - `type: OAuthException`
  - معنی واقعی: **media container هنوز برای publish آماده نیست**
- در نتیجه سیستم خطای processing را با خطای token اشتباه می‌گیرد و پیام نادرستِ reconnect برمی‌گرداند.

## What I will change
1. **Fix auth classification in shared Instagram publish helper**
   - در `supabase/functions/_shared/instagramPublish.ts`
   - منطق `isAuthError()` را محدود می‌کنم تا فقط خطاهای واقعی احراز هویت/permission را auth failure بداند.
   - خطای `9007/2207027` صراحتاً از auth errors خارج می‌شود.

2. **Treat not-ready as processing, not reconnect**
   - همان helper را طوری اصلاح می‌کنم که:
     - `9007/2207027` فقط به‌عنوان `not ready yet` شناخته شود
     - retry/backoff واقعی روی `media_publish` ادامه پیدا کند
     - بعد از اتمام پنجره انتظار، پیام نهایی processing timeout برگردد نه reconnect

3. **Keep manual and cron paths aligned**
   - چون هر دو از helper مشترک استفاده می‌کنند، با همین patch هر دو مسیر زیر همزمان اصلاح می‌شوند:
     - `supabase/functions/social-publish/index.ts`
     - `supabase/functions/social-cron-publish/index.ts`

4. **Validate deployed behavior**
   - Edge Functionها را deploy می‌کنم
   - لاگ‌ها را دوباره بررسی می‌کنم تا مطمئن شوم:
     - دیگر پیام false reconnect تولید نمی‌شود
     - خطاهای `9007/2207027` به‌صورت processing/not-ready مدیریت می‌شوند

## Files involved
- `supabase/functions/_shared/instagramPublish.ts`
- `supabase/functions/social-publish/index.ts`
- `supabase/functions/social-cron-publish/index.ts`

## Expected outcome
- پیام اشتباه «Instagram token expired or missing permissions» حذف می‌شود
- publish فقط در صورت خطای واقعی permission/token پیام reconnect می‌دهد
- برای ریلز/ویدیو، سیستم یا بعد از آماده‌شدن publish می‌کند یا یک خطای دقیق processing timeout برمی‌گرداند، نه reconnect