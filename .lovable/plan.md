

## محدودسازی کامل دسترسی Accounting

### مشکل فعلی
- در سایدبار دسکتاپ، Accounting برای یوزرهای غیرمجاز به صورت "قفل‌شده" نمایش داده می‌شود (باید کاملا مخفی باشد)
- در منوی موبایل، Accounting با نقش‌های `admin/accounting/office` قابل مشاهده است (باید فقط ایمیل‌محور باشد)
- RoleGuard و AccountingWorkspace از قبل درست کار می‌کنند (فقط 3 ایمیل مجاز)

### تغییرات

**1. `src/components/layout/AppSidebar.tsx`**
- آیتم‌هایی که `allowedEmails` دارند و کاربر دسترسی ندارد، به جای نمایش قفل‌شده، کاملا مخفی شوند
- در بخش رندر (خط 224-250): اگر `!accessible` و آیتم `allowedEmails` داشته باشد، اصلا رندر نشود (return null)

**2. `src/components/layout/MobileNavV2.tsx`**
- آیتم Accounting در `moreItems` (خط 21) از `roles` به `allowedEmails` تغییر کند
- فیلتر مربوطه در رندر موبایل اضافه شود تا فقط 3 ایمیل مجاز ببینند

### جزییات فنی

| فایل | تغییر |
|------|-------|
| `AppSidebar.tsx` خط 230 | اضافه شرط: اگر `item.allowedEmails` وجود دارد و `!accessible`، return null (مخفی کامل) |
| `MobileNavV2.tsx` خط 21 | تغییر به `allowedEmails: ["sattar@rebar.shop", "neel@rebar.shop", "vicky@rebar.shop"]` |
| `MobileNavV2.tsx` فیلتر رندر | اضافه چک ایمیل برای آیتم‌های `allowedEmails` |

### نتیجه
- Accounting فقط برای sattar، neel و vicky قابل مشاهده خواهد بود
- سایر یوزرها (از جمله ادمین‌ها مثل radin) اصلا آن را نمی‌بینند
- حفاظت route-level (RoleGuard) از قبل فعال است و تغییر نمی‌کند
