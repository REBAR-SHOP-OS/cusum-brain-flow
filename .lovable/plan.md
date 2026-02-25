

## رفع مشکل ناپایداری پنجره چت و نمایش صحیح مخاطبین

### مشکل
تداخل بین event handler های drag (pointer events) و مکانیزم داخلی Radix Popover باعث می‌شود:
1. `handlePointerDown` پنجره را فوراً می‌بندد
2. `handlePointerUp` دوباره toggle می‌کند (باز می‌کند)
3. `onOpenChange` خود Radix هم اجرا می‌شود → نتیجه: فلیکر و بسته شدن فوری

### راه‌حل
جداسازی کامل منطق drag از منطق Popover:

#### فایل: `src/components/chat/DockChatBar.tsx`

1. **حذف بستن popover از `handlePointerDown`** — فقط drag tracking شروع شود
2. **در `handlePointerUp`**: اگر drag نشده، `launcherOpen` را toggle کن. اگر drag شده، هیچ کاری نکن
3. **غیرفعال کردن `onOpenChange` Radix** هنگام drag — با بررسی `wasDragged.current`
4. **اضافه کردن `e.preventDefault()`** در `handlePointerDown` برای جلوگیری از تداخل Radix
5. **تبدیل PopoverTrigger به `div`** به جای `button` — چون pointer events و Radix trigger با هم تداخل دارند. دکمه داخل div باقی می‌ماند ولی Popover به صورت manual (controlled) مدیریت می‌شود
6. **حذف `PopoverTrigger`** و استفاده از Popover به صورت کاملاً controlled — `open={launcherOpen}` فقط توسط pointer handlers کنترل شود
7. **اضافه کردن click-outside handler** برای بستن popover هنگام کلیک خارج از آن

#### جزئیات فنی

```text
// حذف PopoverTrigger — Popover کاملاً controlled
<Popover open={launcherOpen}>
  <div style={{ left: pos.x, top: pos.y }}>
    <PopoverAnchor asChild>
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlePointerUp}
      >
        <MessageSquare />
      </button>
    </PopoverAnchor>
  </div>
  <PopoverContent onPointerDownOutside={() => setLauncherOpen(false)}>
    ...
  </PopoverContent>
</Popover>

// handlePointerDown: فقط drag شروع شود، popover بسته نشود
const handlePointerDown = (e) => {
  handlers.onPointerDown(e);
};

// handlePointerUp: فقط اگر drag نشده toggle شود
const handlePointerUp = (e) => {
  handlers.onPointerUp(e);
  if (!wasDragged.current) {
    setLauncherOpen(prev => !prev);
  }
};
```

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `src/components/chat/DockChatBar.tsx` | جایگزینی PopoverTrigger با PopoverAnchor + حالت controlled + رفع race condition |

### نتیجه
- کلیک روی دکمه: پنجره مخاطبین باز/بسته می‌شود بدون فلیکر
- درگ دکمه: پنجره باز نمی‌شود، فقط جابجایی انجام می‌شود
- کلیک خارج پنجره: بسته می‌شود
- مخاطبین rebar.shop به درستی فیلتر و نمایش داده می‌شوند

