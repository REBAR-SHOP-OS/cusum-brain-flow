

## رفع مشکل "No address" در صفحه Deliveries

### ریشه مشکل
در فایل `src/hooks/useDeliveryActions.ts`، وقتی delivery stop ایجاد می‌شود (خط 42-49)، فیلد `address` اصلا ست نمی‌شود. آدرس سایت بعدا (خط 53-68) از پروژه خوانده می‌شود ولی فقط در packing slip استفاده می‌شود و هرگز به delivery stop برگردانده نمی‌شود.

### راه‌حل
ترتیب عملیات را تغییر بدهیم: اول آدرس سایت را بخوانیم، بعد delivery stop را با آدرس ایجاد کنیم.

### تغییرات فنی (فقط ۱ فایل)

**فایل: `src/hooks/useDeliveryActions.ts`**

1. بلوک "Fetch project site_address" (خط 53-69) را **قبل از** ایجاد delivery stop (خط 42) منتقل کنیم
2. فیلد `address: siteAddress` را به insert delivery stop اضافه کنیم

```text
ترتیب فعلی:                    ترتیب جدید:
+-------------------+           +-------------------+
| 1. Create delivery|           | 1. Create delivery|
+-------------------+           +-------------------+
| 2. Create stop    |           | 2. Fetch address  |
|    (بدون آدرس!)   |           +-------------------+
+-------------------+           | 3. Create stop    |
| 3. Fetch address  |           |    (با آدرس)      |
+-------------------+           +-------------------+
| 4. Create packing |           | 4. Create packing |
|    slip (با آدرس) |           |    slip (با آدرس) |
+-------------------+           +-------------------+
```

### نتیجه
- Delivery stop با آدرس صحیح ایجاد می‌شود
- صفحه Deliveries به جای "No address" آدرس واقعی پروژه را نمایش می‌دهد
- هیچ تغییری در UI یا دیتابیس لازم نیست
