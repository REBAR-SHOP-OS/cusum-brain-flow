

# تغییر ایجنت پیش‌فرض radin به Vizzy (Assistant)

## وضعیت فعلی

`radin@rebar.shop` از نظر دسترسی، **هم‌اکنون** به همه بخش‌ها دسترسی دارد (SuperAdmin). اما وقتی وارد چت می‌شود، ایجنت پیش‌فرض او **Pixel** (social) است، نه **Vizzy** (assistant).

## مشکل

در فایل `src/lib/userAgentMap.ts`، radin به ایجنت `social` مپ شده:
```
"radin@rebar.shop": {
    agentKey: "social",       // ← باید "assistant" باشد
    userRole: "ai_manager",
    heroText: "How can **Pixel** assist you today?",
    ...
}
```

## تغییر

**فایل: `src/lib/userAgentMap.ts`**

مپینگ `radin@rebar.shop` را از `social` به `assistant` تغییر می‌دهم:

- `agentKey`: `"social"` → `"assistant"`
- `userRole`: `"ai_manager"` → `"ceo"`
- `heroText`: متن Vizzy
- `quickActions`: اکشن‌های مدیریتی/مانیتورینگ مناسب (مشابه sattar)

یک خط تغییر در یک فایل.

