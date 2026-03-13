

# FIX ALL: از "علامت‌زدن" به "حل واقعی"

## مشکل فعلی

دکمه FIX ALL الان فقط وضعیت درخواست‌ها را به `resolved` تغییر می‌دهد — یعنی مشکلات را **پنهان** می‌کند، نه حل.

## واقعیت فنی

بیشتر fix request‌ها از دو منبع می‌آیند:
1. **خطاهای خودکار** (`🤖 Auto-detected:`) — از SmartErrorBoundary وقتی خطایی بعد از چند بار تلاش حل نشود
2. **گزارش‌های دستی** — از Vizzy یا کاربران

یک دکمه فرانت‌اند نمی‌تواند باگ کد را برطرف کند. اما می‌تواند:

## راه‌حل پیشنهادی — FIX ALL هوشمند

### تغییرات در `src/components/ceo/FixRequestQueue.tsx`

وقتی FIX ALL زده شود، به جای فقط `status: resolved`:

1. **خطاهای قدیمی/تکراری (stale)**: اگر خطای auto-detected بیش از ۳۰ دقیقه پیش ثبت شده و دیگر تکرار نشده → resolve (این‌ها واقعاً حل شده‌اند)

2. **خطاهای auth/session**: خودکار `supabase.auth.refreshSession()` را صدا بزند و sessionStorage خطاهای مرتبط را پاک کند

3. **خطاهای cache/storage**: `sessionStorage` مربوط به vizzy_report‌ها را پاک کند تا مانیتورینگ تازه شود

4. **خطاهای کد (code bugs)**: اینها را به Vizzy AI (edge function `ai-agent`) ارسال کند تا بررسی و اقدام عملیاتی انجام دهد — مثل reset ماشین، update وضعیت، یا ثبت task

5. **نتیجه**: یک toast خلاصه نشان دهد: "۳ خطای قدیمی پاک شد، ۱ session رفرش شد, ۲ مورد به Vizzy ارسال شد"

### تغییرات در `supabase/functions/vizzy-erp-action/index.ts`

- اضافه کردن action جدید `bulk_fix_requests` که لیست fix request‌ها را بگیرد و برای هر کدام بر اساس `affected_area` اقدام مناسب انجام دهد:
  - مشکلات ماشین → `update_machine_status` (reset to idle)
  - مشکلات سفارش → بررسی و update وضعیت
  - مشکلات auth → فقط resolve (سمت کلاینت handle شده)
  - باقی → ثبت به عنوان `human_tasks` برای پیگیری

### خلاصه جریان

```text
FIX ALL clicked
  ├── Stale auto-detected (>30min, no repeat) → resolve directly
  ├── Auth/session errors → refresh session + resolve
  ├── Cache errors → clear sessionStorage + resolve  
  └── Remaining (code/operational) → call bulk_fix_requests edge function
       ├── Machine issues → reset machine
       ├── Order issues → update status
       └── Unknown → create human_task + resolve fix request
```

