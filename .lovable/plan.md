

# اصلاح دسترسی saurabh@rebar.shop به Pipeline

## مشکل
کاربر `saurabh@rebar.shop` نقش‌های `workshop` و `office` را دارد ولی نقش `sales` را ندارد. سیاست‌های امنیتی جدول `leads` فقط به نقش‌های `admin`، `sales` و `accounting` اجازه دسترسی می‌دهند.

## راه‌حل
یک دستور SQL برای اضافه کردن نقش `sales` به کاربر:

```text
INSERT INTO user_roles (user_id, role)
VALUES ('1a618127-a569-4134-b4cc-42da73a70399', 'sales')
ON CONFLICT (user_id, role) DO NOTHING;
```

همچنین اگر نقش `workshop` لازم نیست، می‌توان آن را حذف کرد (اختیاری):

```text
DELETE FROM user_roles 
WHERE user_id = '1a618127-a569-4134-b4cc-42da73a70399' 
AND role = 'workshop';
```

و department پروفایل به `office` تنظیم شود:

```text
UPDATE profiles SET department = 'office' 
WHERE user_id = '1a618127-a569-4134-b4cc-42da73a70399';
```

## نتیجه
- با اضافه شدن نقش `sales`، RLS جدول `leads` اجازه خواندن/نوشتن داده‌ها را می‌دهد
- Pipeline و Customers برای کاربر قابل مشاهده خواهد بود
- تغییر کد لازم نیست -- فقط تنظیم دیتابیس

