
# تنظیم عنوان سشن Pixel بر اساس تاریخ انتخابی

## تغییر
در فایل `src/pages/AgentWorkspace.tsx` (خطوط 137-139)، منطق تعیین عنوان سشن را تغییر می‌دهیم تا برای ایجنت `social` (Pixel) به جای متن پیام، تاریخ انتخاب‌شده (`selectedDate`) استفاده شود.

### قبل:
```typescript
const sessionTitle = agentId === "eisenhower"
  ? format(new Date(), "yyyy-MM-dd (EEE, MMM d)")
  : content;
```

### بعد:
```typescript
const sessionTitle = agentId === "eisenhower"
  ? format(new Date(), "yyyy-MM-dd (EEE, MMM d)")
  : agentId === "social"
    ? format(selectedDate, "yyyy-MM-dd")
    : content;
```

## نتیجه
وقتی کاربر در Pixel تاریخی را انتخاب کند و پیامی بفرستد، عنوان سشن در بخش Recents به صورت تاریخ انتخابی (مثلا `2026-02-13`) نمایش داده می‌شود.
