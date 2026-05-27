## ریشه‌ی مشکل (تأیید شده از DB + کد)

دو ردیف LinkedIn در `integration_connections`:
- `scope = "email, openid, profile, w_member_social"` (سه scope حیاتی drop شده)
- `refresh_token = null` (به‌خاطر نبود `offline_access`)
- `organization_ids = {}` (به‌خاطر نبود `r_organization_social`)
- `status = "error"`, expired

کد `linkedin-oauth` همه‌ی scope های لازم را request می‌کند، ولی LinkedIn فقط scopeهایی را اعطا می‌کند که در LinkedIn Developer Portal برای آن App تأیید شده باشند. وقتی Marketing Developer Platform و Sign In with LinkedIn (OIDC با offline_access) تأیید نشده باشد، LinkedIn سکوت می‌کند و فقط scopeهای پایه را برمی‌گرداند. در نتیجه:
- توکن ۶۰ روزه بدون refresh ⇒ خطای انقضا تکرار می‌شود.
- هیچ Company Page کشف نمی‌شود ⇒ پابلیش روی Rebar.shop / Rebar.shop Ontario / Setter همیشه fail می‌کند.

این یک باگ کد نیست؛ یک scope-drop خاموش از طرف LinkedIn است که در حال حاضر بی‌صدا ذخیره می‌شود و کاربر را در حلقه‌ی Reconnect بی‌نتیجه گیر می‌اندازد.

## هدف اصلاح

۱) جلوگیری از ذخیره‌ی یک کانکشن «نیمه‌سالم» (وقتی LinkedIn scope های لازم را drop کرده).
۲) دادن پیام دقیق و قابل اقدام در لحظه‌ی connect، نه در لحظه‌ی publish.
۳) جلوگیری از پاک شدن سابق کانکشن‌های خوب با connectهای بعدی ناقص.

## تغییرات (همگی روی `supabase/functions/linkedin-oauth/index.ts` — جراحی، بدون تغییر معماری)

### ۱) Validate scopes پس از token exchange (handleCallback)
بعد از دریافت `tokens` و قبل از `upsert` در DB:

- محاسبه‌ی `grantedScopes = Set(tokens.scope)`.
- محاسبه‌ی `requestedScopes = ["openid","profile","email","w_member_social","w_organization_social","r_organization_social","offline_access"]`.
- محاسبه‌ی `missing = requestedScopes.filter(s => !grantedScopes.has(s))`.

اگر `missing` خالی نبود:
- کانکشن را با `status = "error"` و `error_message` دقیق ذخیره کن (شامل لیست scopeهای drop شده + لینک به اپ LinkedIn برای فعال کردن «Marketing Developer Platform» و «Sign In with LinkedIn using OIDC»).
- redirect به `/integrations/callback` با `status=error&message=...` تا UI همان لحظه پیام را نمایش دهد.
- توکن باطل هم نباید ذخیره شود اگر `access_token` فقط شخصی است و کاربر صریحاً شخصی نخواست (در غیر این صورت در گام بعدی کاربر دوباره گیج می‌شود).

### ۲) محافظت در برابر overwrite شدن کانکشن سالم
در `upsert` فعلی هر بار همه‌چیز جایگزین می‌شود؛ اگر کانکشن قبلی `organization_ids` داشت و callback جدید با scope ناقص آمده، orgها پاک می‌شوند. اصلاح: اگر `organization_ids` جدید خالی شد ولی قبلی پر بود، orgهای قبلی را **حفظ کن** و در `error_message` بنویس «orgهای قبلی حفظ شدند ولی scope جدید بدون r_organization_social است؛ پابلیش شرکتی ممکن است fail شود».

### ۳) پیام خطای دقیق در `getLinkedInStatusError`
وقتی `expires_at < now()` و `refresh_token == null` و scope فاقد `offline_access` است، علاوه بر متن فعلی، صراحتاً اضافه شود:
> «LinkedIn App هنوز `offline_access` و `Marketing Developer Platform` را تأیید نکرده — Reconnect به‌تنهایی کافی نیست.»

این متن در DM/Toast دیده می‌شود تا کاربر بداند دلیل تکرار خطا.

## تغییر در فرانت (یک خط)

`src/hooks/usePublishPost.ts` خط ۶۳ — وقتی `linkedInStatus.status === "error"` با عبارت «`Marketing Developer Platform`» همراه است، toast را با variant: destructive و duration بلندتر نمایش بده تا کاربر زمان بخواند داشته باشد. (تغییر صرفاً UX، بدون منطق.)

## اقدامات خارج از کد (در گزارش به کاربر — نه در پلن اجرایی)

پس از deploy، باید روی LinkedIn Developer Portal برای App مربوطه:
1. به Products → درخواست **Sign In with LinkedIn using OpenID Connect** (شامل `offline_access`).
2. به Products → درخواست **Share on LinkedIn** (شامل `w_member_social` — قبلاً دارد).
3. به Products → درخواست **Community Management API** یا **Marketing Developer Platform** (برای `r_organization_social` + `w_organization_social`).

تا تأیید نشدن این محصولات، حتی پس از این patch هم پابلیش روی Company Pages ممکن نخواهد بود — ولی کاربر **فوراً** خواهد فهمید چرا و چه باید بکند، به‌جای دیدن خطای مبهم در لحظه‌ی پابلیش.

## فایل‌های اصلاحی

- `supabase/functions/linkedin-oauth/index.ts` (callback + getLinkedInStatusError)
- `src/hooks/usePublishPost.ts` (یک خط toast)

## Verification

- `psql` بررسی ردیف‌های `integration_connections` پس از یک Reconnect واقعی: یا `status=connected` با scope کامل، یا `status=error` با پیام جدید + orgهای قبلی حفظ شده.
- لاگ edge function `linkedin-oauth` پس از callback باید شامل `[linkedin-oauth] Scopes dropped by provider: [...]` باشد در صورت drop.

## محدوده‌ی بسته

- نه تغییر در `social-publish` (پیام‌های آن کافی است).
- نه تغییر در DB schema.
- نه refactor؛ فقط دو الحاق به handleCallback و یک خط ادیت پیام.
