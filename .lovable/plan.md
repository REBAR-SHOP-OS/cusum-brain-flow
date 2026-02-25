
## مخفی‌سازی CEO Portal برای غیر سوپر ادمین‌ها

### وضعیت فعلی
- CEO Portal در سایدبار با `roles: ["admin"]` محدود شده — یعنی همه ادمین‌ها می‌بینند
- در موبایل هم همین وضع است
- صفحه CEOPortal خودش چک `useSuperAdmin` دارد، ولی منو هنوز نمایش داده می‌شود

### تغییرات

**1. `src/components/layout/AppSidebar.tsx`**
- تغییر CEO Portal از `roles: ["admin"]` به `allowedEmails: ["sattar@rebar.shop", "radin@rebar.shop", "ai@rebar.shop"]`
- چون قبلا منطق مخفی‌سازی `allowedEmails` پیاده شده، این آیتم برای سایر کاربران کاملا مخفی خواهد شد

**2. `src/components/layout/MobileNavV2.tsx`**
- تغییر CEO Portal از `roles: ["admin"]` به `allowedEmails: ["sattar@rebar.shop", "radin@rebar.shop", "ai@rebar.shop"]`

### نتیجه
- CEO Portal فقط برای سوپر ادمین‌ها (sattar، radin، ai) قابل مشاهده خواهد بود
- سایر ادمین‌ها و کاربران اصلا آن را نمی‌بینند
- حفاظت سطح صفحه (`useSuperAdmin`) از قبل فعال است
