
# اطمینان از دریافت اعلان‌ها به زبان ترجیحی هر کاربر

## محدوده اجرا (Scope)
**فقط و فقط** فایل‌های زیر تغییر می‌کنند:
- `supabase/functions/notify-on-message/index.ts`
- `supabase/functions/_shared/notifyTranslate.ts` (فایل جدید shared utility)

هیچ بخش دیگری از اپلیکیشن — هیچ UI، هیچ صفحه، هیچ جدول دیتابیس — تغییر نمی‌کند.

---

## تحلیل مشکل

### وضعیت فعلی (مشکل)

در `notify-on-message/index.ts`:

**برای Team Messages:**
```
title  = "Kourosh Zand in #general"        ← یک متن برای همه
preview = "سلام، وقت داری؟"               ← یک متن برای همه
→ همه اعضای کانال (از جمله کاربران فارسی‌زبان) همین را دریافت می‌کنند
```

**برای Support Messages:**
```
title  = "Support: John Doe"              ← یک متن برای همه
preview = "I need help with..."           ← یک متن برای همه
→ همه admin/office users همین را دریافت می‌کنند
```

تابع `preferred_language` را از profiles نمی‌خواند و هیچ ترجمه‌ای انجام نمی‌دهد.

### الگوی صحیح (که قبلاً در `notify-feedback-owner` پیاده‌سازی شده)

`notify-feedback-owner` این کار را به درستی انجام می‌دهد:
1. زبان ترجیحی کاربر را از `profiles.preferred_language` می‌خواند
2. اگر زبان انگلیسی نبود، `translate-message` edge function را صدا می‌زند
3. اعلان را به زبان کاربر ذخیره می‌کند

---

## راه‌حل: Shared Translation Utility + Per-User Localization

### تغییر ۱ — فایل جدید: `supabase/functions/_shared/notifyTranslate.ts`

یک utility مشترک ایجاد می‌کنیم تا:
- متن اعلان (title + body) را به زبان هدف ترجمه کند
- از `translate-message` edge function استفاده کند (که از قبل وجود دارد و با gemini-2.5-flash-lite کار می‌کند)
- در صورت شکست ترجمه، متن انگلیسی را برگرداند (fallback)

```typescript
export async function translateNotification(
  supabaseUrl: string,
  serviceKey: string,
  title: string,
  body: string,
  targetLang: string  // e.g., "fa", "en", "es"
): Promise<{ title: string; body: string }>
```

نکته: چون `translate-message` نیاز به Auth دارد، از `serviceKey` در header استفاده می‌کنیم (همان روشی که `notify-feedback-owner` استفاده می‌کند).

### تغییر ۲ — `notify-on-message/index.ts`

#### در `handleTeamMessage`:

فعلاً profiles را اینگونه می‌خواند:
```typescript
const { data: profiles } = await svc
  .from("profiles")
  .select("id, user_id")   // ← فقط id و user_id
  .in("id", profileIds);
```

تغییر: `preferred_language` هم اضافه می‌شود:
```typescript
const { data: profiles } = await svc
  .from("profiles")
  .select("id, user_id, preferred_language")
  .in("id", profileIds);
```

سپس به جای یک batch insert یکسان برای همه، برای هر کاربر با زبان غیر-انگلیسی ترجمه انجام می‌دهیم:

```typescript
// Group by language → translate once per language
const byLang = groupByLanguage(profiles);
for (const [lang, langProfiles] of Object.entries(byLang)) {
  let { title: localTitle, body: localBody } = { title, body: preview };
  if (lang !== "en") {
    ({ title: localTitle, body: localBody } = await translateNotification(
      supabaseUrl, serviceKey, title, preview, lang
    ));
  }
  const rows = langProfiles.map(p => ({
    user_id: p.user_id,
    title: localTitle,
    description: localBody,
    ...
  }));
  await svc.from("notifications").insert(rows);
}
```

#### در `handleSupportMessage`:

فعلاً `companyProfiles` را بدون `preferred_language` می‌گیرد:
```typescript
const { data: companyProfiles } = await svc
  .from("profiles")
  .select("user_id")   // ← فقط user_id
  ...
```

تغییر: `preferred_language` هم اضافه می‌شود و همان الگوی گروه‌بندی بر اساس زبان اعمال می‌شود.

---

## جزئیات فنی مهم

### گروه‌بندی بر اساس زبان (بهینه‌سازی)
به جای اینکه برای هر کاربر یک ترجمه جداگانه فراخوانی شود (که هزینه بالایی دارد)، کاربران بر اساس `preferred_language` گروه‌بندی می‌شوند:
- کاربران انگلیسی: بدون فراخوانی API
- کاربران فارسی: یک بار ترجمه → برای همه فارسی‌زبانان استفاده می‌شود
- کاربران عربی: یک بار ترجمه → و الی آخر

این روش تعداد API calls را به حداقل می‌رساند.

### Fallback امن
اگر ترجمه به هر دلیلی شکست بخورد (network error، rate limit)، متن انگلیسی اصلی استفاده می‌شود. اعلان همیشه ارسال می‌شود.

### Default Language
کاربرانی که `preferred_language` ندارند (null)، به عنوان `"en"` در نظر گرفته می‌شوند.

---

## خلاصه فایل‌های تغییریافته

| فایل | نوع تغییر |
|------|-----------|
| `supabase/functions/_shared/notifyTranslate.ts` | ایجاد جدید — shared translation utility |
| `supabase/functions/notify-on-message/index.ts` | ویرایش — اضافه کردن preferred_language + ترجمه per-user |

## آنچه تغییر نمی‌کند
- هیچ UI یا صفحه‌ای
- هیچ جدول دیتابیس
- سایر edge functions
- `push-on-notify`, `notify-feedback-owner`, `alert-router`, `daily-team-report`
- ساختار notifications table
- هیچ منطق دیگری در اپلیکیشن
