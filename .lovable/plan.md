

## افزودن انتخاب نوع Packing Slip به صفحه Pickup

### مشکل
در صفحه Pickup، هنگام کلیک روی "Create Pickup Packing Slip"، مستقیماً یک packing slip جدولی ساده نمایش داده می‌شود. امکان انتخاب نوع slip (مثلاً با عکس) وجود ندارد.

### راه‌حل
اضافه کردن یک مرحله میانی قبل از نمایش packing slip که کاربر بتواند نوع slip را انتخاب کند:
- **Standard** — همان جدول فعلی (DeliveryPackingSlip)
- **With Photos** — نمای جدید شامل عکس‌های بارگذاری هر آیتم از loading_checklist

### تغییرات

#### 1. کامپوننت جدید: `src/components/delivery/PhotoPackingSlip.tsx`
یک packing slip جدید با فرمت عکس‌دار:
- هر آیتم در یک کارت با عکس (از photoUrls)، mark number، barcode، طول و تعداد نمایش داده می‌شود
- طراحی بهینه برای پرینت (A4)
- همان هدر و فوتر DeliveryPackingSlip

#### 2. کامپوننت جدید: `src/components/delivery/PackingSlipTypeSelector.tsx`
یک دیالوگ/مودال ساده با دو گزینه:
- "Standard Table" — آیکون جدول
- "With Loading Photos" — آیکون عکس
- دکمه Generate

#### 3. تغییر `src/pages/PickupStation.tsx`
- state جدید: `slipType: "standard" | "photo" | null`
- وقتی "Create Pickup Packing Slip" کلیک می‌شود، به جای `setShowPackingSlip(true)` مستقیم، ابتدا selector نمایش داده شود
- بعد از انتخاب نوع، بر اساس نوع انتخابی یکی از دو کامپوننت render شود
- `photoUrls` که از قبل در state موجود است، به PhotoPackingSlip پاس داده شود

### جزئیات فنی

```text
User clicks "Create Pickup Packing Slip"
            |
   PackingSlipTypeSelector (modal)
      |                    |
  "Standard"          "With Photos"
      |                    |
DeliveryPackingSlip   PhotoPackingSlip
```

- بدون تغییر دیتابیس
- بدون تغییر در flow دلیوری (Deliveries.tsx بدون تغییر باقی می‌ماند)
- PhotoPackingSlip از همان `photoUrls` Map که در PickupStation محاسبه شده استفاده می‌کند

