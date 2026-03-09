

# حذف کامل 10M و 15M از Cutter-02

## مشکل
با وجود فیلتر `machine_capabilities`، امکان نمایش آیتم‌های 10M و 15M در Cutter-02 وجود دارد (مثلاً اگر capabilities اشتباه تنظیم شده باشند).

## راه‌حل — یک تغییر جراحی در یک فایل

### `src/hooks/useStationData.ts`
اضافه کردن یک **hard-filter** بعد از فیلتر نهایی (خط ۱۳۳) که مستقیماً بر اساس `machineId` عمل کند:

```typescript
const CUTTER_02_ID = "b0000000-0000-0000-0000-000000000002";
const BLOCKED_ON_CUTTER_02 = new Set(["10M", "15M"]);
```

در انتهای زنجیره فیلتر cutterها (بعد از `.filter(allowedBarCodes.includes)`):
- اگر `machineId === CUTTER_02_ID` → حذف هر آیتمی که `bar_code` آن `10M` یا `15M` باشد

این فیلتر:
- فقط روی Cutter-02 اعمال می‌شود
- هیچ دستگاه دیگری را تحت تاثیر قرار نمی‌دهد
- مستقل از `machine_capabilities` عمل می‌کند
- هم UI و هم لاجیک را پوشش می‌دهد چون `useStationData` تنها منبع داده ایستگاه است

### فایل‌های تغییریافته
- `src/hooks/useStationData.ts` — ۳ خط اضافه

### بدون تغییر
- دیتابیس، auth، routing، سایر ایستگاه‌ها، ERP

