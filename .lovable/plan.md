# مشکل ریشه‌ای: چرا کارت‌های Scheduled پابلیش نمی‌شدند

## یافته‌های تحقیق

با بررسی دقیق دیتابیس، کرون و لاگ‌های Edge Function، **دو مشکل ریشه‌ای** پیدا شد:

### 🔴 مشکل ۱ — کرون به دلیل عدم تطابق Secret رد می‌شود (علت اصلی)

لاگ تابع `social-cron-publish` در ۲۴ ساعت گذشته:

```
2026-05-14T13:05:00Z ERROR  Invalid or missing internal secret
2026-05-14T13:00:01Z ERROR  Invalid or missing internal secret
2026-05-14T12:55:00Z ERROR  Invalid or missing internal secret
... (تکرار در هر ۵ دقیقه)
```

- کرون `social-cron-publish-every-5min` فعال است و هر ۵ دقیقه فراخوانی می‌شود (`cron.job_run_details` می‌گوید `succeeded` چون درخواست HTTP ارسال شد).
- اما خود تابع، درخواست را با **HTTP 403 — "Invalid or missing internal secret"** رد می‌کند.
- علت: مقدار `INTERNAL_FUNCTION_SECRET` در **Vault** (که کرون از آن می‌خواند) با مقدار `INTERNAL_FUNCTION_SECRET` در **Edge Function Secrets** (که `Deno.env.get()` می‌خواند) **یکسان نیست**. یکی از این دو در گذشته rotate شده ولی دیگری به‌روز نشده است.

نتیجه: **هیچ پست برنامه‌ریزی‌شده‌ای به‌صورت خودکار منتشر نمی‌شود**. تنها زمانی پست می‌رود که یک Admin از UI دستی ترَیگر کند (مسیر "authenticated admin" در `requestHandler.ts` که Bearer token می‌پذیرد).

شواهد در دیتابیس: ۸ پست برای ۵ می ۱۴ ساعت ۱۰:۰۰ UTC برنامه‌ریزی شده بودند، همه با تأخیر ۱۶۸ تا ۱۷۶ دقیقه (~۳ ساعت) منتشر شدند — دقیقاً بازه‌ای که شما به‌صورت دستی Publish زدید.

### 🟠 مشکل ۲ — پست‌های قفل‌شده به جای retry به "failed" می‌روند

در `_shared/publishLock.ts` تابع `recoverStaleLocks`:

```ts
status: "failed",   // ← به‌جای "scheduled" به failed می‌رود
publishing_lock_id: null,
qa_status: "needs_review",
```

اگر یک run تابع timeout بخورد (مثلاً ۸ پست × ۶ صفحه × پردازش مدیای Instagram > ۱۵۰ ثانیه)، پست‌ها در state `publishing` گیر می‌کنند. بعد ۱۰ دقیقه recovery اجرا می‌شود اما به جای برگرداندن به `scheduled` (تا cron بعدی retry کند)، آن‌ها را `failed` می‌کند و کاربر باید دستی approve/republish کند.

---

## برنامه اصلاح

### Step 1 — همگام‌سازی `INTERNAL_FUNCTION_SECRET` بین Vault و Edge Function Secrets

با استفاده از ابزار `secrets`:

1. یک مقدار جدید قوی تولید می‌کنم (UUID v4).
2. `update_secret("INTERNAL_FUNCTION_SECRET", <new>)` برای Edge Function env.
3. یک migration می‌سازم که `vault.update_secret` برای رکورد همنام را با همان مقدار به‌روز کند.
4. همه‌ی توابعی که از این secret استفاده می‌کنند redeploy می‌شوند.

پس از این، خطای 403 از بین می‌رود و cron هر ۵ دقیقه واقعاً پست‌های due را پابلیش می‌کند.

### Step 2 — Self-healing برای پست‌های Stuck

تغییر در `supabase/functions/_shared/publishLock.ts`:

```ts
// recoverStaleLocks — به جای failed، به scheduled برگردان (تا یک retry خودکار)
// با شمارنده retry_count برای جلوگیری از حلقه بی‌نهایت
```

منطق جدید:
- اگر `retry_count < 2` → برگرد به `scheduled` (cron بعدی دوباره تلاش می‌کند).
- اگر `retry_count >= 2` → آنگاه `failed` با `last_error: "Exceeded 2 auto-retries"`.

این نیاز به یک ستون `retry_count int default 0` در `social_posts` دارد (migration).

### Step 3 — Health-check و Alert

اضافه کردن یک شرط در `social-cron-publish`:
- اگر تعداد پست‌های `status='scheduled'` با `scheduled_date < now() - interval '30 minutes'` بیشتر از ۰ شود، یک ردیف در `notifications` با `priority='high'` به Sattar اضافه می‌شود.

این تضمین می‌کند اگر در آینده مجدداً secret یا cron بشکند، در عرض ۳۰ دقیقه متوجه می‌شویم — نه ۳ ساعت بعد.

### Step 4 — فکس فوری برای پست‌های امروز

بعد از اعمال Step 1، یک query یک‌بارِه:

```sql
UPDATE social_posts
SET status = 'scheduled', publishing_lock_id = NULL, last_error = NULL
WHERE status = 'failed'
  AND neel_approved = true
  AND scheduled_date >= now() - interval '24 hours'
  AND last_error ILIKE '%Publishing timed out%';
```

تا cron بعدی پست‌هایی که قبلاً به اشتباه failed شده بودند را retry کند.

---

## فایل‌های تحت تأثیر

- `supabase/functions/_shared/publishLock.ts` (منطق recovery)
- `supabase/functions/social-cron-publish/index.ts` (health-check alert)
- migration جدید: ستون `retry_count`، sync vault secret، یکبار بازنشانی failed → scheduled
- secrets: `INTERNAL_FUNCTION_SECRET` rotate

## ریسک‌ها

- **Rotate کردن `INTERNAL_FUNCTION_SECRET`** ممکن است سایر cronهایی که همین secret را استفاده می‌کنند موقتاً قطع کند تا redeploy شوند. لیست cronهای متأثر: `social-cron-publish`, `qb-incremental-sync`, `gmail-cron-sync`, `vizzy-business-watchdog-15min`, و... — همه پس از redeploy خودکار اصلاح می‌شوند.
- چون vault را با همان مقدار جدید همگام می‌کنم، downtime صفر است.

با تأیید شما، اجرا می‌کنم.
