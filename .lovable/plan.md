

# انتقال آیکون Select All به بالای لیست آیتم‌ها

## تغییر
آیکون `CheckCheck` از هدر (کنار عنوان) حذف شده و به صورت یک دکمه آیکونی بالای لیست آیتم‌ها (بالای اولین آیتم مثل Ontario Steel Detailing) قرار گیرد.

## فایل: `src/components/social/SelectionSubPanel.tsx`

1. **حذف دکمه Select All از هدر** (خطوط 87-97) — حذف بلوک `{isMulti && ...}` از داخل `div.header`.
2. **اضافه کردن دکمه آیکونی بالای لیست** — قبل از `<div className="rounded-lg border bg-card ...">` (خط 102)، یک دکمه آیکونی با `CheckCheck` اضافه شود:

```tsx
{isMulti && (
  <button
    onClick={toggleAll}
    className={`flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
      allSelected ? "text-primary" : "text-muted-foreground hover:text-foreground"
    }`}
    title={allSelected ? "Deselect all" : "Select all"}
  >
    <CheckCheck className="w-4 h-4" />
    <span>{allSelected ? "Deselect All" : "Select All"}</span>
  </button>
)}
```

3. **اصلاح هدر** — `pr-6` روی عنوان حذف شود چون دیگر دکمه‌ای سمت راست هدر نیست.

