
## فرمت‌بندی شماره دلیوری: `[invoice_number]-[sequence]`

### خلاصه
شماره دلیوری از فرمت فعلی `DEL-MM0W5IRV` (تصادفی) به فرمت `[invoice_number]-[01]` تغییر می‌کند. شماره اینویس توسط کاربر به صورت دستی وارد می‌شود.

### تغییرات

**1. `src/pages/LoadingStation.tsx`**
- اضافه کردن یک فیلد ورودی (Input) برای شماره اینویس در بخش progress/bundle info
- این فیلد قبل از دکمه "Create Delivery" نمایش داده می‌شود
- دکمه Create Delivery غیرفعال می‌ماند تا شماره اینویس وارد شود
- مقدار invoiceNumber به `createDeliveryFromBundle` پاس داده می‌شود

**2. `src/hooks/useDeliveryActions.ts`**
- تابع `createDeliveryFromBundle` یک پارامتر جدید `invoiceNumber: string` دریافت می‌کند
- به جای `DEL-{random}`:
  - شمارش تعداد دلیوری‌های موجود با همان شماره اینویس (prefix match) در دیتابیس
  - ساخت شماره ترتیبی دو رقمی: `01`, `02`, `03`, ...
  - فرمت نهایی: `{invoiceNumber}-{sequence}` (مثلاً `2348-01`)
- شماره پکینگ اسلیپ نیز متناظر تغییر می‌کند: `PS-{invoiceNumber}-{sequence}`

**3. `src/hooks/useCompletedBundles.ts`** (بدون تغییر)

### جریان جدید

```text
1. کاربر باندل را انتخاب می‌کند
2. چک‌لیست لود را تکمیل می‌کند
3. شماره اینویس (مثلاً 2348) را در فیلد جدید وارد می‌کند
4. دکمه Create Delivery فعال می‌شود
5. سیستم تعداد دلیوری‌های موجود با prefix "2348-" را شمارش می‌کند → sequence = 01
6. شماره دلیوری: 2348-01
7. شماره پکینگ اسلیپ: PS-2348-01
```

### جزئیات فنی

| فایل | تغییر |
|------|-------|
| `LoadingStation.tsx` خطوط 75-81 و 193-206 | اضافه state `invoiceNumber`، فیلد Input، پاس دادن به hook |
| `useDeliveryActions.ts` خطوط 13-22 | اضافه پارامتر `invoiceNumber`، کوئری count برای sequence، حذف فرمت قدیمی |

### Validation
- فیلد اینویس الزامی است (نباید خالی باشد)
- اگر اینویس قبلاً دلیوری داشته باشد، sequence خودکار افزایش می‌یابد (مثلاً `2348-02`)
