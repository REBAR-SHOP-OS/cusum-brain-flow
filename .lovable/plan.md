

# حذف پروفایل فیک HIII

## شناسایی
- Profile ID: `659cf30a-71b2-42a7-b5f7-3fbb28176420`
- نام: `HIII`
- بدون ایمیل، بدون user_id، بدون نقش، بدون فعالیت
- احتمالاً از طریق دکمه "+ Add New Name" دستی ساخته شده

## تغییرات

### Migration
```sql
DELETE FROM public.profiles
WHERE id = '659cf30a-71b2-42a7-b5f7-3fbb28176420';
```

فقط همین — چون `user_id` ندارد، نیازی به حذف از `auth.users` نیست.

### نتیجه
- HIII از Team Status، Time Clock و همه لیست‌ها حذف می‌شود
- هیچ داده‌ای از دست نمی‌رود چون فعالیتی نداشته

