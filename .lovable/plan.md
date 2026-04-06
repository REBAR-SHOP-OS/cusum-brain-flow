

# حذف ۲ اکانت tempmail خطرناک

## وضعیت فعلی
این دو اکانت در جدول `profiles` وجود ندارند (ثبت‌نام‌شان تکمیل نشده) اما احتمالاً هنوز در `auth.users` باقی هستند.

## تغییرات

### Migration: حذف از auth.users بر اساس ایمیل
```sql
DELETE FROM auth.users WHERE email IN (
  'testuser2026@tempmail.com',
  'temp.test.uitesting.2024@disposable.local'
);
```

### نتیجه
- هر دو اکانت از سیستم auth کاملاً حذف می‌شوند
- دیگر امکان تلاش مجدد ورود ندارند
- با سیستم invite-only فعلی، ثبت‌نام مجدد هم غیرممکن است

