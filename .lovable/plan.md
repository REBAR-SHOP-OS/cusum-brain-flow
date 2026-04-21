

# اضافه کردن Profile کوروش به سیستم تا در Face Memory ظاهر شود

## وضعیت فعلی
- ایمیل `kourosh@rebar.shop` در whitelist لاگین (`accessPolicies.ts`) و در `allowed_login_emails` ثبت است.
- اما در جدول `profiles` هیچ ردیفی برای کوروش وجود ندارد (۱۰ profile موجود است؛ کوروش بینشان نیست).
- چون پنل Face Memory و dropdown «Add Person» داده‌هایش را از `profiles` می‌خواند، کوروش نه در لیست enrolled افراد دیده می‌شود و نه قابل enroll شدن است.
- علت: کوروش هرگز با اکانت خودش sign-in نکرده، پس trigger ساخت profile اجرا نشده. (یا profile قدیمی‌اش دستی پاک شده — در database لاگ حذفی ندیدیم.)

## راه‌حل (یک migration کوچک، بدون تغییر کد)

ساخت یک profile جدید برای کوروش با همان `company_id` که بقیه پروفایل‌های `@rebar.shop` دارند:

```sql
INSERT INTO public.profiles (full_name, email, company_id, is_active, user_id)
SELECT 'Kourosh Zand', 'kourosh@rebar.shop',
       (SELECT company_id FROM profiles WHERE email='radin@rebar.shop' LIMIT 1),
       true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM profiles WHERE email='kourosh@rebar.shop'
);
```

- `full_name` = `Kourosh Zand` (مطابق نامش در `agents/operations.ts` و `vizzyFullContext.ts`)
- `is_active = true` تا در پنل dropdown ظاهر شود
- `user_id = NULL` — وقتی روزی کوروش لاگین کند، با ایمیل auto-link می‌شود
- idempotent — اگر profile وجود داشته باشد، چیزی نمی‌سازد

## بعد از migration (دستی توسط رادین یا ساتار)
1. روی دستگاه کیوسک (`ai@rebar.shop`)، پنل **Face Memory** → دکمهٔ **Add Person**
2. **Kourosh Zand** را از لیست انتخاب کنید
3. سه عکس از صورت کوروش بگیرید
4. کوروش به‌عنوان نفر نهم در Face Memory ظاهر می‌شود و از این به بعد Face ID او را می‌شناسد و clock in/out می‌کند

## Files
- یک migration جدید SQL (تنها INSERT شرطی)

## Untouched
- `FaceMemoryPanel.tsx`, `useProfiles.ts`, `face-recognize`, `kiosk-punch`, `accessPolicies.ts`, `TimeClock.tsx` — هیچ‌کدام دست نمی‌خورد

## Validation
بعد از migration: `SELECT full_name FROM profiles WHERE email='kourosh@rebar.shop'` باید **Kourosh Zand** را برگرداند، و نام او بلافاصله در dropdown «Add Person» داخل پنل Face Memory ظاهر می‌شود.

