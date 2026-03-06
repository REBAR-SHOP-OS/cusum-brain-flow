

# انتقال "Kourosh Zand" به Team Status Shop

## تغییر
در فایل `src/pages/TimeClock.tsx` خطوط 179-184، فیلتر `officeProfiles` و `shopProfiles` به‌روز شود تا "Kourosh Zand" از Office حذف و به Shop اضافه شود:

```typescript
const officeProfiles = activeProfiles.filter(
  (p) => p.email?.toLowerCase().endsWith("@rebar.shop") && p.full_name !== "Kourosh Zand"
);
const shopProfiles = activeProfiles.filter(
  (p) => !p.email?.toLowerCase().endsWith("@rebar.shop") || p.full_name === "Kourosh Zand"
);
```

این تغییر باعث می‌شود "Kourosh Zand" با وجود داشتن دامنه `@rebar.shop` در تب Shop نمایش داده شود و محدودیت‌های ساعتی Office (۸ صبح) نیز برای او اعمال نشود (چون در `useTimeClock.ts` استثنا `kourosh@rebar.shop` قبلاً وجود دارد).

