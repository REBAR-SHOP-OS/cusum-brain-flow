

## مشکل
در `src/pages/Home.tsx` (خط 99-103) یک `useEffect` وجود دارد که **همه کاربران با صفحه‌نمایش ≤1024px** را بدون بررسی نقش به `/shop-floor` ریدایرکت می‌کند:

```typescript
useEffect(() => {
  if (isTablet) {
    navigate("/shop-floor", { replace: true });
  }
}, [isTablet, navigate]);
```

برای zahra@rebar.shop این یک حلقه بی‌نهایت ایجاد می‌کند:
1. `/home` → useEffect → ریدایرکت به `/shop-floor`
2. RoleGuard (blockedFromShopFloor) → ریدایرکت به `/home`
3. تکرار → صفحه سفید

## راه‌حل
این useEffect باید کاربران `blockedFromShopFloor` و super admin‌ها را مستثنی کند.

### تغییرات

**فایل:** `src/pages/Home.tsx` (خطوط 99-103)

تغییر useEffect به:
```typescript
useEffect(() => {
  if (isTablet && !isSuperAdmin && !ACCESS_POLICIES.blockedFromShopFloor.includes(user?.email?.toLowerCase() ?? "")) {
    navigate("/shop-floor", { replace: true });
  }
}, [isTablet, navigate, isSuperAdmin, user?.email]);
```

این نیاز به import کردن `ACCESS_POLICIES` و استفاده از `isSuperAdmin` که قبلاً در همین فایل موجود است دارد.

