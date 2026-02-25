

## فیلتر کانتکت‌های چت بر اساس دامنه rebar.shop

### مشکل فعلی
وقتی کاربران با ایمیل `@rebar.shop` روی دکمه چت کلیک می‌کنند، تمام پروفایل‌ها (داخلی و خارجی) نمایش داده می‌شود. باید فقط کانتکت‌های داخلی شرکت (با دامنه `@rebar.shop`) نمایش داده شود.

### تغییرات

#### فایل: `src/components/chat/DockChatBar.tsx`

1. **Import** کردن `useAuth` از `@/lib/auth`
2. **تشخیص کاربر داخلی**: بررسی اینکه ایمیل کاربر فعلی با `@rebar.shop` تمام می‌شود
3. **فیلتر پروفایل‌ها**: اگر کاربر داخلی باشد، فقط پروفایل‌هایی نمایش داده شود که ایمیلشان با `@rebar.shop` تمام می‌شود
4. **فیلتر کانال‌های DM**: کانال‌های DM نیز فقط با پروفایل‌های فیلترشده مقایسه شوند

#### جزئیات فنی

```text
const { user } = useAuth();
const isInternal = (user?.email ?? "").endsWith("@rebar.shop");

// فیلتر پروفایل‌ها برای بخش "Start a Chat"
const visibleProfiles = profiles.filter(p => {
  if (p.id === myProfile?.id) return false;
  if (p.is_active === false) return false;
  if (isInternal) return p.email?.endsWith("@rebar.shop");
  return true;
});
```

- بخش "Start a Chat" از `visibleProfiles` استفاده می‌کند
- بخش DM channels هم بر اساس همین فیلتر عمل می‌کند
- کاربران خارجی (غیر rebar.shop) همچنان تمام کانتکت‌های فعال را می‌بینند

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `src/components/chat/DockChatBar.tsx` | اضافه شدن فیلتر دامنه rebar.shop برای کانتکت‌ها و DM |
