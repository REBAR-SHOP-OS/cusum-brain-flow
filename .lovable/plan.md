

# فیلتر سخت‌گیرانه برای Cutter-01 — فقط 10M و 15M

## مشکل
دیتابیس درست است (Cutter-01 فقط 10M و 15M دارد)، اما فیلتر امنیتی client-side فقط برای Cutter-02 نوشته شده. باید همین محافظت برای Cutter-01 هم اضافه شود.

## تغییرات — یک فایل: `src/hooks/useStationData.ts`

فیلتر موجود در خطوط 134-138 را گسترش می‌دهیم تا Cutter-01 هم شامل شود:

```typescript
.filter((item: StationItem) => {
  const CUTTER_01_ID = "e2dfa6e1-8a49-48eb-82a8-2be40e20d4b3";
  const CUTTER_02_ID = "b0000000-0000-0000-0000-000000000002";
  const ALLOWED_ON_CUTTER_01 = new Set(["10M", "15M"]);
  const BLOCKED_ON_CUTTER_02 = new Set(["10M", "15M"]);
  
  if (machineId === CUTTER_01_ID && !ALLOWED_ON_CUTTER_01.has(item.bar_code)) return false;
  if (machineId === CUTTER_02_ID && BLOCKED_ON_CUTTER_02.has(item.bar_code)) return false;
  return true;
})
```

### بدون تغییر
- سایر فایل‌ها، دیتابیس، و منطق سایر ماشین‌ها بدون تغییر
- این فیلتر روی تمام سه قسمت (Machine Card، Project Picker counts، Item list) اعمال می‌شود چون همه از همین hook تغذیه می‌شوند

