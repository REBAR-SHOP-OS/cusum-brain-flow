
# چرا هنوز ارور می‌گیریم

دیتابیس همین الان این رو نشون می‌ده:

- هر دو کانکشن LinkedIn:
  - `status = error`
  - `refresh_token = NULL`
  - `scope = email, openid, profile, w_member_social` (هیچ‌کدوم از `offline_access` / `w_organization_social` / `r_organization_social` نیست)
  - `organization_ids = 0` (هیچ کمپانی پیجی پیدا نشده)
  - token هردو expired

کد ما در `linkedin-oauth/index.ts` خط ۳۱۸ این scopeها رو می‌خواد:
`openid profile email w_member_social w_organization_social r_organization_social offline_access`

ولی LinkedIn فقط `email openid profile w_member_social` رو برمی‌گردونه. این یعنی LinkedIn App شما در LinkedIn Developer Portal فقط برای "Share on LinkedIn" تأیید شده، و برای "Sign In with LinkedIn using OpenID Connect" (که `offline_access` می‌ده) و "Community Management API" (که `w_organization_social` می‌ده) تأیید نشده. هرچقدر هم Reconnect بزنیم، LinkedIn همین scopeهای ناقص رو می‌ده ← refresh_token نمی‌سازه ← کانکشن می‌میره ← Publish fail.

این رو با کد خودمون به تنهایی نمی‌شه دور زد — مگر اینکه از LinkedIn App **خودمون** خارج بشیم و از LinkedIn App **تأیید‌شده‌ی Lovable** استفاده کنیم.

# راه‌حل پیشنهادی: مهاجرت به Lovable LinkedIn Connector

Lovable یه `linkedin` connector داره که از Connector Gateway استفاده می‌کنه. مزایاش:

- LinkedIn App تأیید‌شده با تمام scopeهای لازم (شامل publish به company pages)
- token refresh اتوماتیک توسط gateway — دیگه `expires_at` و `refresh_token` و این داستان‌ها رو ما مدیریت نمی‌کنیم
- دیگه نیازی به LinkedIn Developer Portal و انتظار برای approve کردن "Community Management API" نیست

## تغییرات کد

1. **اتصال connector (یک‌بار، توسط شما در UI):**
   - فراخوانی `standard_connectors--connect` با `connector_id="linkedin"` → کاربر LinkedIn رو با اپ Lovable connect می‌کنه → secret به اسم `LINKEDIN_API_KEY` در محیط در دسترس می‌شه.

2. **`supabase/functions/social-publish/index.ts`** — مسیر LinkedIn:
   - اگر `LINKEDIN_API_KEY` موجود بود → publish رو از طریق gateway انجام بده:
     ```
     POST https://connector-gateway.lovable.dev/linkedin/v2/ugcPosts
     Authorization: Bearer ${LOVABLE_API_KEY}
     X-Connection-Api-Key: ${LINKEDIN_API_KEY}
     ```
   - برای discovery آرگ‌ها (company pages قابل publish):
     `GET /v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED`
   - برای member URN: `GET /v2/userinfo`
   - مسیر OAuth قدیمی (linkedin-oauth) به عنوان fallback می‌مونه ولی preference با gateway هست.

3. **`src/hooks/usePublishPost.ts`**:
   - `check-status` رو تغییر بدیم تا اول وجود `LINKEDIN_API_KEY` (از طریق یه edge function سبک یا check در social-publish) رو بپرسه. اگر gateway در دسترس بود، connection check قدیمی رو skip کنه و مستقیم publish بزنه.

4. **`src/pages/IntegrationCallback.tsx` و کارت LinkedIn در Settings → Integrations**:
   - یه دکمه‌ی جدید: "Connect via Lovable (recommended)" که در صورت کلیک `standard_connectors--connect` رو trigger می‌کنه. کارت قدیمی custom-OAuth به عنوان legacy علامت می‌خوره.

5. **`linkedin-token-health`**:
   - وقتی gateway فعال باشه، این cron برای کانکشن‌های legacy فقط `status='error'` و پیام راهنمای migrate می‌نویسه (دیگه سعی نمی‌کنه refresh کنه چون refresh_token اصلاً وجود نداره).

6. **تست رگرسیون جدید** (`tests/regression/social/linkedin-gateway-publish.test.ts`):
   - mock کردن `LINKEDIN_API_KEY` و assertion روی اینکه social-publish به URL gateway می‌زنه، نه به `api.linkedin.com` مستقیم.

## فایل‌های دست‌خورده

- ویرایش: `supabase/functions/social-publish/index.ts` (مسیر gateway برای LinkedIn)
- ویرایش: `src/hooks/usePublishPost.ts` (skip کردن check-status وقتی gateway فعاله)
- ویرایش: `src/pages/IntegrationCallback.tsx` + کارت LinkedIn در Settings → Integrations (CTA جدید برای connect via Lovable)
- ویرایش: `supabase/functions/linkedin-token-health/index.ts` (پیام migration برای کانکشن‌های legacy)
- جدید: `tests/regression/social/linkedin-gateway-publish.test.ts`

## اعتبارسنجی بعد از build

- `curl` به social-publish با یه پست تستی LinkedIn → 200، و در دیتابیس `social_posts.status='published'`
- `vitest` روی تست جدید
- در preview، روی یه پست LinkedIn دکمه‌ی Publish Now → موفقیت بدون redirect به reconnect

## چیزی که این plan انجام **نمی‌ده**

- بدون اجازه‌ی شما، secret یا کانکشن جدیدی نمی‌سازه — اولین قدم اینه که شما توی UI روی "Connect via Lovable" کلیک کنید (یا الان همینجا تأیید کنید تا من `standard_connectors--connect` رو فراخوانی کنم).
- Neel Approval Gate دست نخورده.
- مسیر کد custom OAuth حذف نمی‌شه (به عنوان fallback می‌مونه) تا اگر بخواید بعداً LinkedIn App خودتون رو approve کنید، هنوز کار کنه.

# سؤال قبل از شروع

آیا اجازه می‌دید همین حالا `standard_connectors--connect` رو با `linkedin` صدا بزنم و بعد کد رو به استفاده از gateway مهاجرت بدم؟ یا ترجیح می‌دید فقط روی مسیر فعلی (تأیید LinkedIn App خودتون در Developer Portal) بمونیم؟
