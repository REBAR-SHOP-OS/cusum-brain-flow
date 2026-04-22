
# علت دقیق خطای «LinkedIn Publishing Failed»

## یافته ریشه‌ای (قطعی، با شواهد DB)

### وضعیت کانکشن‌های LinkedIn در DB
دو کانکشن LinkedIn در جدول `integration_connections` وجود دارد (هر دو متعلق به Sattar):

| user_id | status | scope ذخیره‌شده | organization_ids |
|---|---|---|---|
| `c9b3adc2…` | connected | `email, openid, profile, w_member_social` | **NULL** |
| `be3b9444…` | connected | `email, openid, profile, w_member_social` | **NULL** |

### کد چه چیزی **انتظار دارد** (در `linkedin-oauth/index.ts` خط ۱۹۸)
```
scope = "openid profile email w_member_social w_organization_social r_organization_social"
```

### کد چه چیزی **دریافت کرده**
```
scope = "openid profile email w_member_social"   ❌ دو scope گم شده
```

### دو scope گم‌شده
- `r_organization_social` — لازم برای فراخوانی `/v2/organizationAcls` (کشف شرکت‌ها)
- `w_organization_social` — لازم برای **publish** به‌نام Company Page

## زنجیره خطا (دقیقاً همان چیزی که در اسکرین‌شات دیدی)

1. کاربر در گذشته LinkedIn را وصل کرده **قبل از این‌که** scope‌های organization به کد اضافه شوند → token فقط با scope شخصی صادر شد.
2. در `linkedin-oauth/index.ts` خط ۱۳۹، فراخوانی `organizationAcls` بدون scope `r_organization_social` با **403** برمی‌گردد → بلوک `if (aclRes.ok)` رد می‌شود → `organizationIds` خالی می‌ماند → در DB `null` ذخیره می‌شود.
3. هنگام publish (`social-publish/index.ts` خط ۸۷۳): `config.organization_ids || {}` → `{}` → هیچ مَچی برای `Ontario Steel Detailing`، `Rebar.shop`، `Ontario Logistics`، `Ontario Steels`، `Rebar.shop Ontario` پیدا نمی‌شود → خطا پرتاب می‌شود:
   > `LinkedIn organization ID not configured for "<page>". Please reconnect LinkedIn to auto-discover organization pages.`
4. چون پست برای **۵ صفحه** بود، پنج خطای مشابه به‌هم چسبیده شده‌اند که در UI به‌صورت متن قرمز طولانی می‌بینی.

## چرا پلتفرم‌های دیگر (Facebook, Instagram) موفق بودند
آن‌ها از مسیر کاملاً جدا (`user_meta_tokens`, خط‌های ۲۰۲–۲۴۵) عبور می‌کنند که سالم است. مشکل **فقط** در LinkedIn است.

## چرا «Retry Publishing» این را درست نمی‌کند
Retry فقط همان function را دوباره صدا می‌زند؛ token قدیمی همچنان scope ندارد و `organization_ids` همچنان `NULL` است → ابدی fail می‌شود.

## راه‌حل (فقط برای اطلاع — اقدام نکردم چون در حالت plan هستم)

**یک اقدام، توسط کاربر:**
- Sattar باید از Settings → Integrations روی LinkedIn → **Disconnect** و سپس **Connect** بزند.
- این بار صفحه consent از LinkedIn، scope‌های `r_organization_social` و `w_organization_social` را درخواست می‌کند (کد قبلاً به آن‌ها مجهز است).
- بعد از تأیید، تابع `handleCallback` خودکار organizationAcls را می‌خواند، ۵ صفحه (Ontario Steel Detailing, Rebar.shop, Ontario Logistics, Ontario Steels, Rebar.shop Ontario) را کشف می‌کند و در `config.organization_ids` ذخیره می‌کند.
- پس از reconnect، دکمه **Retry Publishing** روی همان پست کار خواهد کرد.

**هیچ تغییر کد لازم نیست** — کد سمت سرور درست است؛ فقط token قدیمی است و باید refresh شود با scope جدید.

## اختیاری (اگر می‌خواهی محکم‌تر شود — plan جداگانه)
اگر می‌خواهی این مشکل دیگر هرگز silent نباشد، می‌توان یک گارد در `linkedin-oauth` اضافه کرد که اگر scope برگشتی شامل `w_organization_social` نبود، status را `connected` ست نکند و خطای واضح نمایش دهد. ولی این تغییر اختیاری است و ربطی به رفع وضعیت فعلی ندارد.

## خلاصه یک‌خطی
**Token LinkedIn فعلی scope `w_organization_social` ندارد، پس org IDs در connect کشف نشدند و publish به Company Pages قطعاً fail می‌کند. راه‌حل: Disconnect و دوباره Connect کردن LinkedIn از Settings.**
