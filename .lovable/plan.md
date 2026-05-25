## Goal
Scheduled / draft / pending-approval / publishing کارت‌ها نباید پیج‌هاشون سبز یا قرمز نشون داده بشه. فقط زمانی رنگی بشن که واقعاً تلاش publish انجام شده باشه (published / failed).

## Change (UI only)
فایل: `src/components/social/SocialCalendar.tsx`

1. در `parsePageStatuses` یک حالت سوم `pending` اضافه می‌کنیم (به جای فقط `failed: true/false`). برای پست‌هایی که status شون `scheduled`، `draft`، `pending_approval` یا `publishing` هست و هیچ entry موفق/ناموفقی در `page_results` ندارن، خروجی pending برمی‌گردونیم.

2. در `PageStatusDropdown` رندر سه‌حالته:
   - `failed` → آیکن `XCircle` قرمز + متن `text-destructive` (مثل الان)
   - `success` → آیکن `CheckCircle2` سبز + متن سبز (مثل الان)
   - `pending` → آیکن `Circle` خنثی + متن `text-muted-foreground` (بی‌رنگ)

3. منطق structured `page_results`: اگر برای یک پیج entry `success`/`failed` ثبت شده باشه (حتی روی پست scheduled) همون رنگ نشون داده میشه — یعنی فقط پیج‌هایی که هنوز attempt نشدن خنثی می‌مونن.

هیچ تغییری در backend, hooks, یا types نمی‌دیم.

## Files
- `src/components/social/SocialCalendar.tsx` (فقط)

## Validation
- کارت scheduled بدون page_results → همه‌ی پیج‌ها خاکستری/خنثی
- کارت published → پیج‌های موفق سبز، پیج‌های ناموفق قرمز (بدون تغییر)
- کارت failed → پیج‌های ناموفق قرمز، بقیه طبق page_results
- کارت partial publish → mix درست
