

## اضافه کردن Sales Department به سایدبار و Command Bar

### مشکل
Sales Department (`/sales`) در هیچ‌کدام از سایدبار اصلی (`AppSidebar.tsx`) و Command Bar (`CommandBar.tsx`) وجود ندارد. فقط در `Sidebar.tsx` قدیمی اضافه شده.

### تغییرات

**1. `src/components/layout/AppSidebar.tsx`** — افزودن آیتم Sales Department به گروه Office
- بعد از Accounting (خط 166)، یک آیتم جدید اضافه شود:
  ```
  { name: "Sales", href: "/sales", icon: TrendingUp, tourId: "nav-sales" }
  ```
- ایمپورت `TrendingUp` از lucide-react

**2. `src/components/layout/CommandBar.tsx`** — افزودن Sales به navCommands
- اضافه کردن آیتم‌های Sales Department:
  ```
  { label: "Sales Department", icon: TrendingUp, href: "/sales", group: "Navigate" }
  { label: "Sales Pipeline", icon: Kanban, href: "/sales/pipeline", group: "Navigate" }
  { label: "Sales Quotations", icon: FileText, href: "/sales/quotations", group: "Navigate" }
  { label: "Sales Invoices", icon: Receipt, href: "/sales/invoices", group: "Navigate" }
  { label: "Sales Contacts", icon: Users, href: "/sales/contacts", group: "Navigate" }
  ```
- ایمپورت `TrendingUp, Receipt` از lucide-react

**3. `src/components/layout/MobileNavV2.tsx`** — افزودن Sales به منوی موبایل
- اضافه کردن `{ name: "Sales", href: "/sales", icon: TrendingUp }`

### نتیجه
Sales Department در سایدبار، جستجو (Cmd+K)، و منوی موبایل قابل دسترسی خواهد بود.

