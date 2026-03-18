
هدف: هر ۳ آیکون شناور (Screenshot، Chat، Vizzy) واقعا قابل Drag باشند و موقعیتشان ذخیره شود.

تشخیص علت اصلی:
- در `src/lib/floatingPortal.ts` روی `document` و خود `floating-layer` یک listener در فاز capture گذاشته شده که روی `pointerdown` برای `[data-feedback-btn]`، `stopImmediatePropagation()` می‌زند.
- این کار در فاز capture باعث می‌شود رویداد به target نرسد یا چرخه رویداد ناقص شود؛ در نتیجه `onPointerDown/onPointerMove/onPointerUp` مربوط به درگ پایدار اجرا نمی‌شود.
- چون هر ۳ آیکون از همین الگو و `data-feedback-btn` استفاده می‌کنند، مشکل برای هر ۳ مورد همزمان دیده می‌شود.

برنامه اجرا:

1) اصلاح هسته رویدادها در `floatingPortal.ts`
- حذف کامل listenerهای capture-level که روی `pointerdown`، propagation را قطع می‌کنند (هم روی `document` هم روی `container`).
- نگه‌داشتن فقط مسئولیت پورتال: ساخت `#floating-layer`، `z-index` بالا، `pointer-events:none` روی کانتینر، و mutation observer برای آخرین فرزند body بودن.

2) یکسان‌سازی الگوی درگ در ۳ کامپوننت شناور
- `ScreenshotFeedbackButton.tsx`
- `DockChatBar.tsx`
- `FloatingVizzyButton.tsx`
- الگوی استاندارد:
  - `onPointerDown`: فقط شروع درگ (با stopPropagation در سطح React)، بدون قطع global/native در capture.
  - `onPointerMove`: جابجایی.
  - `onPointerUp`: اگر drag نشده بود، اکشن کلیک اجرا شود (Capture/Click تفکیک حفظ شود).
- هدف: Drag و Tap با هم تداخل نداشته باشند.

3) کنترل تداخل با Popover/Drawer به‌صورت موضعی (نه global)
- در `DockChatBar.tsx` و هر overlay مرتبط، فقط از `onPointerDownOutside/onInteractOutside` برای نادیده گرفتن interaction روی `[data-feedback-btn]` استفاده شود.
- جلوگیری از بستن ناخواسته popupها بدون شکستن drag کل سیستم.

4) اعتبارسنجی نهایی (Acceptance)
- هر ۳ آیکون با mouse drag جابجا شوند.
- بعد از refresh، هر کدام در موقعیت جدید خود باقی بمانند (localStorage keyهای مجزا).
- tap ساده همچنان اکشن اصلی هر آیکون را اجرا کند.
- در حالت باز بودن popover/dialog هم drag قطع نشود.

فایل‌های هدف:
- `src/lib/floatingPortal.ts`
- `src/components/feedback/ScreenshotFeedbackButton.tsx`
- `src/components/chat/DockChatBar.tsx`
- `src/components/vizzy/FloatingVizzyButton.tsx`
