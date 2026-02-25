
## محدود کردن دسترسی اکانتینگ به ۳ کاربر خاص

### خلاصه
دسترسی به بخش Accounting فقط و فقط برای ۳ ایمیل زیر باز باشد:
- `sattar@rebar.shop`
- `neel@rebar.shop`
- `vicky@rebar.shop`

هیچ کاربر دیگری، حتی ادمین‌ها، نباید این بخش را ببینند یا به آن دسترسی داشته باشند.

### تغییرات

**1. `src/components/layout/AppSidebar.tsx`**
- به `NavItem` فیلد اختیاری `allowedEmails?: string[]` اضافه شود
- آیتم Accounting: حذف `roles` و اضافه `allowedEmails: ["sattar@rebar.shop", "neel@rebar.shop", "vicky@rebar.shop"]`
- در تابع `hasAccess`: اگر `allowedEmails` وجود داشته باشد، فقط ایمیل کاربر چک شود (بدون توجه به نقش admin)

**2. `src/pages/AccountingWorkspace.tsx`**
- تغییر خط 170: `hasAccess` از role-based به email-based
- ثابت `ACCOUNTING_EMAILS = ["sattar@rebar.shop", "neel@rebar.shop", "vicky@rebar.shop"]`
- `const hasAccess = ACCOUNTING_EMAILS.includes(user?.email ?? "")`
- حذف وابستگی به `isAdmin` و `hasRole("accounting")` برای دسترسی

**3. `src/components/auth/RoleGuard.tsx`**
- اضافه کردن محافظت مسیر `/accounting` برای ایمیل‌های غیرمجاز (ریدایرکت به `/home`)

### جزئیات فنی

| فایل | تغییر |
|------|-------|
| `AppSidebar.tsx` خط 21-29 | اضافه `allowedEmails` به `NavItem` |
| `AppSidebar.tsx` خط 159 | تغییر آیتم Accounting به `allowedEmails` |
| `AppSidebar.tsx` خط 190-197 | تغییر `hasAccess` برای چک `allowedEmails` |
| `AccountingWorkspace.tsx` خط 170 | تغییر `hasAccess` به email-based |
| `RoleGuard.tsx` | اضافه بلاک ریدایرکت `/accounting` برای ایمیل‌های غیرمجاز |

### نتیجه
- فقط Sattar، Neel و Vicky آیتم Accounting را در سایدبار می‌بینند
- فقط همین ۳ نفر می‌توانند وارد صفحه `/accounting` شوند
- ادمین‌ها و سایر کاربران حتی آیتم را در منو نمی‌بینند
