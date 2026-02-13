

# دسترسی کاربر sourabh@rebar.shop به عنوان Sales

## وضعیت فعلی
کاربر `sourabh@rebar.shop` هنوز در سیستم ثبت‌نام نکرده. بعد از ثبت‌نام، باید نقش `sales` به او اختصاص داده شود.

## مراحل

### 1. ثبت‌نام کاربر
ابتدا `sourabh@rebar.shop` باید وارد اپلیکیشن شود و ثبت‌نام کند. بعد از ثبت‌نام، پروفایل او به‌صورت خودکار ساخته می‌شود.

### 2. اختصاص نقش sales
بعد از ثبت‌نام، با یک دستور SQL نقش `sales` به او اختصاص داده می‌شود:

```text
INSERT INTO user_roles (user_id, role)
SELECT id, 'sales' FROM auth.users WHERE email = 'sourabh@rebar.shop';
```

### 3. دسترسی‌های نقش sales (از قبل تنظیم شده)
با نقش `sales`، کاربر به این صفحات دسترسی دارد:
- `/pipeline` (اصلی - CRM)
- `/customers`
- `/office`
- `/inbox`
- `/phonecalls`
- `/settings`
- `/home`
- `/brain`
- `/timeclock`
- `/integrations`
- `/agent`
- `/daily-summarizer`

بقیه صفحات مثل accounting، shop floor و غیره برای او مسدود هستند.

### 4. به‌روزرسانی department پروفایل
Department پروفایل هم به `office` تنظیم می‌شود تا در لیست تیم درست نمایش داده شود.

### خلاصه تغییرات
- تغییر کد لازم نیست - دسترسی‌های sales از قبل در `RoleGuard` تنظیم شده
- فقط بعد از ثبت‌نام کاربر، نقش در دیتابیس اضافه می‌شود

