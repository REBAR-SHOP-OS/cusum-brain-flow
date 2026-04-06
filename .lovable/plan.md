

# حذف اکانت‌های فیک و بستن دسترسی

## اکانت‌های شناسایی شده
- `test` (test@example.com) — profile ID: `d05b9a26-...`, user_id: `0c6d3e84-...`
- `teamhubm6hy75h9` (teamhubm6hy75h9@sharebot.net) — profile ID: `61418b17-...`, user_id: `af19e13a-...`

هر دو بدون نقش، بدون فعالیت.

## تغییرات

### 1. Migration: حذف پروفایل‌ها و کاربران auth
یک migration که:
- رکوردهای `profiles` این دو نفر را حذف کند
- رکوردهای `auth.users` مربوطه را هم حذف کند (cascade از auth.users باعث حذف خودکار profiles هم می‌شود، اما برای اطمینان هر دو جدول بررسی می‌شود)

```sql
DELETE FROM public.profiles WHERE id IN (
  'd05b9a26-de81-4704-8f3e-39b7123ac070',
  '61418b17-84aa-4fa2-9c7c-567fa1e0c126'
);
DELETE FROM auth.users WHERE id IN (
  '0c6d3e84-59de-4caf-97bb-d7a4190c3b26',
  'af19e13a-3efe-43d0-a9fb-6bad9b37d324'
);
```

### نتیجه
- هر دو اکانت فیک کاملاً حذف می‌شوند
- دیگر در لیست پروفایل‌ها، Time Clock، یا Team Hub ظاهر نمی‌شوند
- اطلاعات auth آنها هم پاک می‌شود و دیگر نمی‌توانند لاگین کنند

