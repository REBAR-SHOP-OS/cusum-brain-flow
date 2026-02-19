
# نمایش دائمی دکمه حذف فایل در بخش Attachments

## مشکل موجود

کد کنونی (خط 854-860) دکمه X را فقط هنگام hover نمایش می‌دهد:
```tsx
className="opacity-0 group-hover/attachment:opacity-100 ..."
```

این باعث می‌شود:
- در موبایل دکمه اصلاً قابل استفاده نباشد (hover وجود ندارد)
- یوزر متوجه نشود که می‌تواند فایل را حذف کند
- UX گیج‌کننده است چون دکمه پنهان است

## راه‌حل — یک خط تغییر در Tasks.tsx

فقط `opacity-0 group-hover/attachment:opacity-100` را از className دکمه X حذف می‌کنم تا همیشه قابل مشاهده باشد:

```tsx
// قبل:
className="opacity-0 group-hover/attachment:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"

// بعد:
className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-1"
```

دکمه X همیشه کنار هر فایل نمایش داده می‌شود و روی hover قرمز می‌شود.

## فایل تغییر می‌کند

فقط یک خط در `src/pages/Tasks.tsx` (خط 856).
