

# فیلتر کردن پروفایل‌های کیوسک از Team Status Shop و تطبیق نام با پروفایل‌های موجود

## مشکلات فعلی

1. **پروفایل‌های ساخته‌شده توسط کیوسک** (بدون `user_id` و `email`) در Team Status Shop نمایش داده می‌شوند چون فیلتر فقط بر اساس ایمیل `@rebar.shop` است
2. **هنگام ثبت‌نام جدید در کیوسک** (`kiosk-register`)، همیشه یک پروفایل جدید ساخته می‌شود بدون اینکه بررسی شود آیا فردی با همان نام در سیستم وجود دارد یا نه
3. **Kiosk Status** فقط ورودی‌های با `source: "kiosk"` را نشان می‌دهد ولی باید هر کسی که از طریق face scan شناسایی شده را هم نشان دهد

## تغییرات

### ۱. فایل: `src/pages/TimeClock.tsx`

**فیلتر Team Status Shop (خط ۱۸۲-۱۸۴)**: پروفایل‌هایی که `user_id` ندارند (ساخته‌شده توسط کیوسک) از لیست Shop حذف شوند:
```typescript
const shopProfiles = activeProfiles.filter(
  (p) => 
    p.user_id && // فقط پروفایل‌های واقعی (نه کیوسک-ساخته)
    (!p.email?.toLowerCase().endsWith("@rebar.shop") || p.full_name === "Kourosh Zand")
);
```

### ۲. فایل: `supabase/functions/kiosk-register/index.ts`

**تطبیق نام با پروفایل‌های موجود (قبل از insert)**: قبل از ساختن پروفایل جدید، بررسی شود آیا پروفایلی با نام مشابه (case-insensitive) در همان شرکت وجود دارد:
- اگر وجود داشت → از همان `profile_id` استفاده شود و فقط face enrollment و clock-in ثبت شود
- اگر وجود نداشت → پروفایل جدید ساخته شود (رفتار فعلی)

```
// Pseudo logic:
const existingProfile = await svc.from("profiles")
  .select("id")
  .eq("company_id", companyId)
  .ilike("full_name", trimmedName)
  .single();

if (existingProfile) → use existing, skip insert
else → create new profile
```

### ۳. فایل: `supabase/functions/kiosk-punch/index.ts`

**ذخیره source برای clock-out**: هنگام clock-out هم `source: "kiosk"` ثبت شود تا Kiosk Status بتواند ردیابی کند (فعلاً فقط clock-in این فیلد را دارد). البته clock-out فقط update می‌کند پس نیازی نیست.

## فایل‌های تغییر
1. `src/pages/TimeClock.tsx` — فیلتر `user_id` برای حذف پروفایل‌های کیوسکی از Team Status Shop
2. `supabase/functions/kiosk-register/index.ts` — تطبیق نام با پروفایل‌های موجود قبل از ساخت جدید

