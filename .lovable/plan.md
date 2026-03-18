

## بررسی وضعیت فعلی

هر سه آیکون شناور (📷 اسکرین‌شات، 💬 چت، 👩 Vizzy) **هم‌اکنون قابلیت درگ دارند** — همگی از `useDraggablePosition` و پورتال `floating-layer` استفاده می‌کنند. اما دو مشکل وجود دارد:

### مشکل ۱: دکمه چت — Popover مانع درگ می‌شود
در `DockChatBar.tsx`، دکمه چت داخل یک `Popover` از Radix قرار دارد. وقتی Popover باز است، رویداد `pointerdown` روی دکمه ممکن است توسط Radix بلع شود و درگ درست کار نکند. همچنین `e.preventDefault()` در `handlePointerDown` ممکن است با منطق Radix تداخل داشته باشد.

### مشکل ۲: دکمه Vizzy — کلیک و درگ تفکیک ناقص
در `FloatingVizzyButton.tsx`، رویدادهای pointer روی container خارجی (`div`) تنظیم شده، ولی دکمه داخلی (`button`) هم `onClick` دارد. در بعضی شرایط، هر دو fire می‌شوند.

### مشکل ۳: تداخل با کشویی‌ها (Drawers/Modals)
وقتی یک Drawer یا Modal باز است، Radix `DismissableLayer` ممکن است `pointerdown` روی آیکون‌ها را به عنوان "outside click" تشخیص دهد و کشویی را ببندد.

---

## طرح رفع مشکلات

### ۱. `DockChatBar.tsx` — جداسازی درگ از Popover
- `onPointerDown` روی container خارجی (`div`) تنظیم شود، نه روی button
- `e.nativeEvent.stopImmediatePropagation()` اضافه شود (مثل ScreenshotButton)
- Popover فقط با تپ (بدون درگ) باز شود

### ۲. `FloatingVizzyButton.tsx` — اصلاح تداخل container/button
- `e.nativeEvent.stopImmediatePropagation()` در `onPointerDown` اضافه شود (الان فقط `stopImmediatePropagation` روی native event فراخوانی می‌شود ولی نه به شکل صحیح)

### ۳. `ScreenshotFeedbackButton.tsx` — بدون تغییر
- این دکمه قبلاً به درستی پیاده‌سازی شده و الگوی درستی دارد

### ۴. `floatingPortal.ts` — تقویت محافظت
- اطمینان از اینکه رویداد `pointerdown` در فاز capture روی تمام عناصر `data-feedback-btn` متوقف می‌شود تا Radix DismissableLayer آنها را "outside click" تشخیص ندهد

### فایل‌های تغییر:
- `src/components/chat/DockChatBar.tsx` — اصلاح ساختار pointer events
- `src/components/vizzy/FloatingVizzyButton.tsx` — اضافه کردن `stopImmediatePropagation`

