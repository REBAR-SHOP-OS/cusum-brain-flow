
# حذف کامل کاربر Ryle Lachini

## محدوده (Strict)
فقط یک کاربر مشخص با این مشخصات هدف است:
- **Name:** Ryle Lachini
- **Email:** ryle.lachini@gmail.com
- **Profile ID:** `d950f825-adf4-418f-a4c3-44562631e1c8`
- **Auth User ID:** `56aa737c-c917-40ec-8a88-502cc83ee4d3`

هیچ فایل کدی تغییر نمی‌کند. تمام عملیات از طریق database migration/data operations انجام می‌شود.

---

## وضعیت داده‌های موجود (یافته‌شده)

| جدول | تعداد رکورد | اقدام |
|------|-------------|-------|
| `profiles` | 1 رکورد | `is_active = false` + `user_id = NULL` |
| `time_clock_entries` | 2 رکورد | حفظ می‌شود (داده تاریخی) |
| `team_channel_members` | 1 رکورد | حذف می‌شود |
| `notifications` | 1 رکورد | حذف می‌شود |
| `team_messages` | 0 | نیازی به اقدام نیست |
| `leave_requests` | 0 | نیازی به اقدام نیست |
| `user_roles` | 0 | نیازی به اقدام نیست |

---

## مراحل اجرا

### مرحله ۱ — غیرفعال‌سازی پروفایل (بی‌اثر کردن در لیست‌ها)
```sql
UPDATE public.profiles
SET 
  is_active = false,
  user_id = NULL,         -- قطع ارتباط با auth user → دیگر لاگین نمی‌تواند
  email = 'deleted_d950f825@removed.invalid'  -- جلوگیری از conflict در آینده
WHERE id = 'd950f825-adf4-418f-a4c3-44562631e1c8';
```

چرا `user_id = NULL`؟ چون کد `useProfiles` و `useTimeClock` برای نمایش، `profiles.user_id` را با `auth.uid()` مقایسه می‌کند. با NULL شدن، این کاربر از همه لیست‌های فعال (`is_active = true`) حذف می‌شود و دیگر نمایش داده نمی‌شود.

### مرحله ۲ — پاک‌سازی رکوردهای جانبی
```sql
-- حذف عضویت از channel‌ها (هیچ داده مهمی نیست)
DELETE FROM public.team_channel_members
WHERE profile_id = 'd950f825-adf4-418f-a4c3-44562631e1c8';

-- حذف notification‌های این کاربر
DELETE FROM public.notifications
WHERE user_id = '56aa737c-c917-40ec-8a88-502cc83ee4d3';
```

### مرحله ۳ — حذف auth user (قطع دسترسی ورود)

این مرحله نیاز به اجرا از طریق Supabase Admin API دارد (نه SQL معمولی):
از طریق **Lovable Cloud backend → Authentication → Users** باید auth user با ID `56aa737c-c917-40ec-8a88-502cc83ee4d3` حذف شود.

یا می‌توان از طریق migration با `service_role` این کار را انجام داد:
```sql
-- این فقط با service_role کار می‌کند، نه anon/authenticated
DELETE FROM auth.users WHERE id = '56aa737c-c917-40ec-8a88-502cc83ee4d3';
```

---

## نتیجه پس از اجرا

| وضعیت | نتیجه |
|-------|--------|
| نمایش در Time Clock | حذف شده (is_active = false) |
| نمایش در Team Status | حذف شده (is_active = false) |
| امکان لاگین | ممنوع (auth user حذف / user_id = NULL) |
| داده‌های time_clock_entries | حفظ شده (داده تاریخی سالم می‌ماند) |
| سایر کاربران | دست‌نخورده |

---

## فایل‌های تغییریافته

| فایل | اقدام |
|------|-------|
| Database (data operation) | UPDATE profiles + DELETE از جداول جانبی |
| auth.users | حذف auth record |

**هیچ فایل کدی تغییر نمی‌کند.**
