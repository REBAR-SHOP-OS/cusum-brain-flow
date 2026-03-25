

## حذف دسترسی zahra به Shop Floor

### مشکل
zahra@rebar.shop وقتی روی Shop Floor کلیک می‌کند صفحه Command Hub را می‌بیند، در حالی که فقط باید به داشبورد اصلی (`/home`) دسترسی داشته باشد.

### راه‌حل
zahra@rebar.shop را به لیست `blockedFromShopFloor` در `src/lib/accessPolicies.ts` اضافه می‌کنیم. این باعث می‌شود:
1. در sidebar، آیتم Shop Floor برای او قفل یا مخفی شود
2. در صورت ورود مستقیم به `/shop-floor`، به داشبورد ریدایرکت شود

### تغییرات

#### 1. `src/lib/accessPolicies.ts`
اضافه کردن `zahra@rebar.shop` به آرایه `blockedFromShopFloor`:
```typescript
blockedFromShopFloor: ["zahra@rebar.shop"] as string[],
```

#### 2. بررسی اعمال بلاک در sidebar و routing
- بررسی می‌کنم که `blockedFromShopFloor` در `AppSidebar.tsx` و `ShopFloor.tsx` اعمال شود
- اگر لازم باشد، ریدایرکت از `/shop-floor` به `/home` برای ایمیل‌های بلاک‌شده اضافه می‌شود

### فایل‌های درگیر
- `src/lib/accessPolicies.ts`
- `src/pages/ShopFloor.tsx` (اضافه کردن ریدایرکت در صورت نیاز)
- احتمالاً `src/components/layout/AppSidebar.tsx` (بررسی اعمال فیلتر)

