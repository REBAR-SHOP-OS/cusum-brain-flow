

## مشکل: "Failed to add item" با JWT نامعتبر

### علت اصلی
تابع `refreshSessionIfNeeded` از `getSession()` استفاده می‌کند که فقط localStorage را می‌خواند. اگر یک JWT فاسد/منقضی در localStorage باشد، `session` برگردانده می‌شود (truthy) و refresh انجام **نمی‌شود**. سپس درخواست‌های دیتابیس با JWT نامعتبر ارسال شده و RLS آنها را رد می‌کند.

لاگ‌ها تایید می‌کنند: `bad_jwt` / `missing sub claim` مکرراً از `cusum-brain-flow.lovable.app`.

### راه‌حل
در `refreshSessionIfNeeded` بجای `getSession()` از `getUser()` استفاده شود تا JWT سمت سرور اعتبارسنجی شود:

```typescript
const refreshSessionIfNeeded = useCallback(async () => {
  const { error } = await supabase.auth.getUser();
  if (error) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      toast.error("Session expired – please log in again");
      await supabase.auth.signOut({ scope: "local" });
      return false;
    }
  }
  return true;
}, []);
```

### فایل تغییر
- `src/hooks/usePurchasingList.ts` — خطوط 78-89: اصلاح `refreshSessionIfNeeded`

### نتیجه
اگر JWT نامعتبر باشد → refresh token اجرا می‌شود → JWT جدید دریافت → عملیات موفق. اگر refresh هم ناموفق باشد → logout خودکار.

