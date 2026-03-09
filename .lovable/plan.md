

# تغییر سوپر ادمین — فقط sattar@rebar.shop

## تغییرات
در **۷ فایل** لیست `SUPER_ADMIN_EMAILS` از سه ایمیل به فقط یک ایمیل تغییر می‌کند:

```typescript
// قبل
const SUPER_ADMIN_EMAILS = ["sattar@rebar.shop", "radin@rebar.shop", "ai@rebar.shop"];

// بعد
const SUPER_ADMIN_EMAILS = ["sattar@rebar.shop"];
```

### فایل‌ها
1. `src/hooks/useSuperAdmin.ts`
2. `src/components/office/DiagnosticLogView.tsx`
3. `supabase/functions/diagnostic-logs/index.ts`
4. `supabase/functions/ringcentral-active-calls/index.ts`
5. `supabase/functions/ringcentral-action/index.ts`
6. `supabase/functions/ringcentral-fax-send/index.ts`
7. `supabase/functions/ringcentral-sip-provision/index.ts`

### بدون تغییر
- دیتابیس، routing، RoleGuard، admin role — بدون تغییر
- نقش `admin` در `user_roles` تغییر نمی‌کند (سوپر ادمین مستقل از نقش admin است)

