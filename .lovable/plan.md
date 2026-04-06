

# حل مشکل روشن ماندن صفحه تبلت در Face ID Kiosk

## مشکل
وقتی کیوسک فعال است، دوربین به‌صورت دائم استریم ویدیو دارد. مرورگرها وقتی یک `MediaStream` فعال روی `<video>` وجود دارد، صفحه را خاموش نمی‌کنند. نتیجه: تبلت هرگز به خواب نمی‌رود و باتری آسیب می‌بیند.

## راه‌حل: Sleep Timer برای کیوسک

وقتی کیوسک بی‌استفاده بماند (مثلاً ۵ دقیقه بدون اسکن یا لمس صفحه)، دوربین خاموش شود و صفحه به حالت خواب (sleep screen) برود. با لمس صفحه دوباره بیدار شود.

### تغییرات

#### 1. `src/pages/TimeClock.tsx`

**a) Idle Timer (5 دقیقه)**
- هر بار که `handleScan` زده می‌شود یا صفحه لمس می‌شود، تایمر ریست شود
- بعد از ۵ دقیقه بی‌فعالیتی:
  - `face.stopCamera()` → استریم ویدیو قطع شود → مرورگر اجازه خواب دارد
  - یک overlay تاریک نمایش داده شود با پیام "Tap to wake / لمس کنید"

**b) Wake on Touch**
- وقتی کاربر overlay را لمس کند:
  - `face.startCamera()` دوباره اجرا شود
  - overlay حذف شود
  - تایمر idle ریست شود

**c) فقط در Kiosk Mode**
- این منطق فقط وقتی `kioskMode === true` فعال باشد

### ساختار کد

```text
[Kiosk Active]
     │
     ▼
 Activity detected? ──yes──► Reset 5-min timer
     │ no (5 min)
     ▼
 Stop camera stream
 Show dark overlay: "Tap to wake"
     │
     ▼
 Touch detected → startCamera() → hide overlay → reset timer
```

### فایل‌های تغییر
- `src/pages/TimeClock.tsx` — اضافه کردن idle timer، sleep overlay، و wake handler

### نتیجه
- تبلت بعد از ۵ دقیقه بی‌فعالیتی اجازه خواب دارد
- باتری محافظت می‌شود
- با یک لمس فوری دوباره آماده اسکن است

