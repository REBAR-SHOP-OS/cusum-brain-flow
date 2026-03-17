

## مشکل: تاریخ Due Date یک روز عقب‌تر نمایش داده می‌شود

### ریشه مشکل
وقتی `new Date("2026-03-17")` اجرا می‌شود، JavaScript آن را به‌عنوان **UTC midnight** تفسیر می‌کند. برای کاربران در timezone‌های غرب UTC (مثل EST/PST)، این به شب ۱۶ مارس تبدیل می‌شود. بنابراین هم نمایش و هم انتخاب Calendar یک روز عقب‌تر نشان می‌دهد.

### راه‌حل
اضافه کردن تابع `parseDateString` که تاریخ را به‌صورت **local** پارس می‌کند:

```typescript
function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}
```

### محل‌های نیاز به تغییر در `src/pages/Tasks.tsx`

| خط | فعلی | تغییر |
|-----|-------|--------|
| 143 | `new Date(task.due_date)` (×2 در isOverdue) | `parseDateString(task.due_date)` |
| 155 | `new Date(a.due_date).getTime()` | `parseDateString(a.due_date).getTime()` |
| 155 | `new Date(b.due_date).getTime()` | `parseDateString(b.due_date).getTime()` |
| 1033 | `new Date(task.due_date)` | `parseDateString(task.due_date)` |
| 1267 | `new Date(selectedTask.due_date)` | `parseDateString(selectedTask.due_date)` |
| 1273 | `new Date(selectedTask.due_date)` | `parseDateString(selectedTask.due_date)` |

### فایل‌ها
- `src/pages/Tasks.tsx` — اضافه کردن `parseDateString` و جایگزینی تمام `new Date(dateString)` ها

