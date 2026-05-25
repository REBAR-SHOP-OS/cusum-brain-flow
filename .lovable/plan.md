# Root-cause fix: per-page publish results

## مشکل واقعی (تأیید شده با کوئری DB)

برای پست‌های Mon May 25:

| Platform | status (DB) | last_error |
|---|---|---|
| Facebook | `published` | — |
| Instagram | **`failed`** | `Publishing timed out — recovered from stale lock` |
| LinkedIn | **`failed`** | `… LinkedIn token expired and refresh failed …` |

پس UI درست رنگ می‌زنه — Instagram و LinkedIn واقعاً `failed` هستن. اما **چرا**:

- **LinkedIn**: legit failure (token expired روی هر ۳ صفحه). نیاز به reconnect در Integrations.
- **Instagram**: `recoverStaleLocks` در `social-cron-publish` قفل بیش از ۱۰ دقیقه‌ای رو دیده، **کل پست رو به `failed` تبدیل کرده بدون اینکه بدونه کدوم صفحه‌ها واقعاً پابلیش شدن**. این ریشه‌ی مشکله.

## ریشه‌ی معماری

`social-publish/index.ts` نتایج per-page (`pageSuccesses[]`, `pageErrors[]`) رو فقط در پایان run داخل متن `last_error` خلاصه می‌کنه. هیچ ستون structured برای per-page result نداریم. وقتی stale-lock recovery می‌زنه:

1. اطلاعات per-page از دست می‌ره.
2. اگر مثلاً ۴ از ۶ صفحه IG موفق شده باشه، همه قرمز می‌شن.
3. UI نمی‌تونه truth واقعی رو نمایش بده.

علاوه بر این، parsing از روی `last_error` (regex روی متن آزاد) شکننده‌ست.

## راه‌حل

### 1. ستون structured per-page results

Migration: اضافه کردن `page_results jsonb` به `social_posts`:

```jsonc
[
  { "name": "Rebar.shop",        "status": "success", "platform_post_id": "12345_67890", "completed_at": "..." },
  { "name": "Ontario Steels",    "status": "failed",  "error": "Image too large", "completed_at": "..." },
  { "name": "Ontario Logistics", "status": "pending" }
]
```

### 2. `social-publish/index.ts` — write-as-you-go

- در ابتدای run، `page_results` رو با تمام صفحات به‌صورت `pending` initialize کن.
- بعد از publish هر صفحه (FB/IG/LinkedIn/Twitter)، **بلافاصله** ردیف اون صفحه رو در `page_results` آپدیت کن (نه فقط در پایان).
- این طوری اگر edge function timeout یا crash بشه، partial successes حفظ می‌شن.

### 3. `_shared/publishLock.ts` — recovery هوشمند

`recoverStaleLocks` به‌جای flat `status='failed'`:

- بخون `page_results` پست.
- هر `pending` رو به `failed` با error `"Publishing timed out for this page"` تبدیل کن.
- اگر **همه** `success` → `status='published'`، `last_error=null`.
- اگر **حداقل یکی** `success` → `status='published'`، `last_error="Partial: <failed pages summary>"`.
- اگر **هیچ‌کدوم** `success` → `status='failed'` (رفتار فعلی).

### 4. `SocialCalendar.tsx` — منبع حقیقت structured

در `parsePageStatuses`:

- اگر `post.page_results` موجود و non-empty → از همون استفاده کن (per-page status مستقیم).
- در غیر این صورت fallback به منطق فعلی parse از `last_error` (برای پست‌های قدیمی قبل از migration).

### 5. LinkedIn token expiry (مشکل ثانویه‌ی همین کارت)

این فیکس فقط display رو درست می‌کنه. خود LinkedIn هنوز fail می‌شه چون token expire شده. کاربر باید از Integrations → LinkedIn، reconnect کنه. این خارج از scope این فیکس کده.

## فایل‌های تغییر یافته

- **Migration جدید**: `add page_results jsonb to social_posts`
- `supabase/functions/social-publish/index.ts` (initialize + per-page write + final write)
- `supabase/functions/_shared/publishLock.ts` (`recoverStaleLocks` smart recovery)
- `src/components/social/SocialCalendar.tsx` (`parsePageStatuses` prefer `page_results`)
- `src/hooks/useSocialPosts.ts` (اضافه کردن `page_results` به type/select اگر لازم)

## تست

پس از اعمال:

1. یک پست IG با ۳ صفحه publish کن.
2. اگر همه موفق → همه سبز، `status=published`.
3. شبیه‌سازی timeout (مثلاً یکی fail بشه) → اون یکی قرمز با error دقیق، بقیه سبز، status=`published` partial.
4. شبیه‌سازی stale lock (status `publishing` بمونه >10 دقیقه با ۲ صفحهٔ موفق ثبت‌شده در `page_results`) → cron باید به `published` partial بازیابی کنه نه `failed` کامل.

## بدون scope creep

- بدون refactor wide-ranging.
- additive: ستون جدید، logic موجود حفظ می‌شه (fallback).
- migration safe — default `'[]'::jsonb`.
- بدون تغییر در policies یا RLS.
