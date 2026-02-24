

## مرتب‌سازی و گروه‌بندی لیست Manifest‌ها در صفحه Office

### مشکل فعلی
- لیست manifest‌ها فقط بر اساس `created_at` مرتب شده (جدیدترین اول)
- هیچ گروه‌بندی بر اساس پروژه یا شرکت وجود ندارد
- manifest‌هایی که به یک پروژه تعلق دارند (مثلا "JD Sector Vault" و "Vault 1" هر دو مال SECTOR CONTRACTING) پراکنده نمایش داده می‌شوند

### داده‌های موجود
هر `cut_plan` یک `project_id` دارد و هر `project` یک `customer_id` که به جدول `customers` (با `company_name`) لینک شده. یعنی زنجیره داده کامل است:

```text
cut_plan -> project -> customer (company_name)
```

### راه‌حل: گروه‌بندی دو سطحی

لیست manifest‌ها را به صورت **گروه‌بندی شده** نمایش بدهیم:

```text
NORTHFLEET GROUP
  +-- EARNSCLIFFE CRICKET AIR DOME  [completed]
  +-- Ford Oakville 13th Feb        [completed]

SECTOR CONTRACTING LTD.
  +-- JD Sector Vault               [completed]
  +-- Vault 1                       [completed]

BRONTE CONSTRUCTION
  +-- 25 HALFORD AVE ... - HAE      [completed]
  +-- 25 HALFORD AVE ... - HAF      [completed]

Rutherford Contracting ltd.
  +-- FOOTINGS AND WALLS - BPD      [completed]
  +-- MASONRY WALL - BPF            [completed]
  +-- SLAB ON GRADE - BPE           [completed]
```

- گروه‌های شرکت: مرتب‌شده الفبایی بر اساس نام شرکت
- manifest‌ها داخل هر گروه: مرتب‌شده الفبایی بر اساس نام scope (manifest name)
- هر گروه collapsible باشد برای تعامل جداگانه

---

### تغییرات فنی

#### فایل ۱: `src/hooks/useCutPlans.ts`
- در `fetchPlans`، query را تغییر بدهیم تا `project_id` را با join به `projects(name, customer_id, customers(name, company_name))` بخوانیم
- یا ساده‌تر: یک query جداگانه برای project و customer data بزنیم

#### فایل ۲: `src/components/office/DetailedListView.tsx`
- داده‌ها را بر اساس `company_name` گروه‌بندی کنیم (با `useMemo`)
- گروه‌های شرکت را الفبایی مرتب کنیم
- داخل هر گروه، manifest‌ها را الفبایی بر اساس نام مرتب کنیم
- هر گروه شرکت را با یک هدر و Collapsible نمایش بدهیم
- از `@radix-ui/react-collapsible` (که قبلا نصب شده) استفاده شود

#### ساختار UI جدید
```text
[شرکت A]  (3 manifests)           <- هدر قابل کلیک
  | manifest 1  [status]
  | manifest 2  [status]
  | manifest 3  [status]

[شرکت B]  (2 manifests)
  | manifest 1  [status]
  | manifest 2  [status]
```

### نکات
- manifest‌هایی که `project_id` ندارند در گروه "Ungrouped" قرار می‌گیرند
- همه گروه‌ها به صورت پیش‌فرض باز هستند
- عملکرد کلیک روی manifest (انتخاب و نمایش جزئیات) بدون تغییر باقی می‌ماند

