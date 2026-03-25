

## مشکل
وقتی از Production Queue روی Edit کلیک می‌کنید، `selectedPlanId` در `DetailedListView` ست می‌شود و وارد جزئیات آن manifest می‌شوید. بعد اگر از سایدبار روی "Detailed List" کلیک کنید، `activePlanId` در `OfficePortal` به `null` ریست می‌شود، اما `useEffect` داخل `DetailedListView` فقط وقتی `initialPlanId` truthy باشد `selectedPlanId` را آپدیت می‌کند — پس هرگز به `null` برنمی‌گرداند و همچنان جزئیات همان manifest نمایش داده می‌شود.

## راه‌حل
در `src/components/office/DetailedListView.tsx`، `useEffect` (خطوط 23-27) را اصلاح می‌کنیم تا همیشه `selectedPlanId` را با `initialPlanId` سینک کند — نه فقط وقتی truthy است:

```typescript
useEffect(() => {
  setSelectedPlanId(initialPlanId ?? null);
}, [initialPlanId]);
```

این تنها تغییر لازم است. با این اصلاح، کلیک روی "Detailed List" در سایدبار، لیست گروه‌بندی‌شده manifests (مطابق اسکرین‌شات) را نمایش می‌دهد.

### فایل درگیر
- `src/components/office/DetailedListView.tsx` — فقط اصلاح useEffect

