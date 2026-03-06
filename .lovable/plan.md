

# حذف یوزر "Ai" از لیست Team Status

## تغییر
در فایل `src/pages/TimeClock.tsx` خط 176، نام "Ai" به لیست حذف‌شده‌ها اضافه شود:

```typescript
const activeProfiles = profiles.filter(
  (p) => !["General Labour", "Ryle Lachini", "Ai"].includes(p.full_name)
);
```

این تغییر باعث می‌شود یوزر "Ai" از هر دو تب Team Status Office و Team Status Shop حذف شود.

