
مسئله‌ای که الان می‌بینیم دقیقاً این است: درخواست `odoo-crm-sync` با وضعیت 200 برمی‌گردد اما بدنه پاسخ `{"disabled": true, "error":"Odoo integration is disabled"}` است؛ یعنی کد تابع وارد گارد `ODOO_ENABLED` می‌شود. با توجه به اینکه secret وجود دارد، ریشه مشکل احتمالاً «مقدار غیر دقیق» (مثل `"True"`, `" true "`, `"\"true\""` یا مشابه) و وابستگی به مقایسه سخت‌گیرانه `=== "true"` در چندین تابع است.

برنامه اجرای ریشه‌ای:

1) یکپارچه‌سازی پارس Feature Flag در بک‌اند  
- ایجاد helper مشترک در `supabase/functions/_shared` برای خواندن بولین از env با نرمال‌سازی:
  - trim
  - lowercase
  - حذف quote
  - پذیرش `true | 1 | yes | on`
- خروجی helper: `isEnabled("ODOO_ENABLED", false)`.

2) حذف مقایسه شکننده در همه توابع Odoo  
- جایگزینی تمام موارد `Deno.env.get("ODOO_ENABLED") !== "true"` با helper مشترک در فایل‌های:
  - `supabase/functions/odoo-crm-sync/index.ts`
  - `supabase/functions/odoo-chatter-sync/index.ts`
  - `supabase/functions/archive-odoo-files/index.ts`
  - `supabase/functions/odoo-sync-order-lines/index.ts`
  - `supabase/functions/odoo-reconciliation-report/index.ts`
  - `supabase/functions/odoo-file-proxy/index.ts`
  - `supabase/functions/autopilot-engine/index.ts`
- نتیجه: حتی اگر مقدار secret با فرمت متفاوت ذخیره شده باشد، سیستم همچنان درست فعال می‌شود.

3) افزودن لاگ تشخیصی استاندارد (بدون افشای داده حساس)  
- در شاخه disabled یک log کوتاه اضافه می‌شود که فقط مقدار normalize‌شده/وضعیت parse را ثبت کند (نه secret کامل).
- هدف: اگر دوباره غیرفعال شد، سریعاً بفهمیم مشکل از env است یا از جای دیگر.

4) بهبود پیام UX در Pipeline  
- در `src/pages/Pipeline.tsx` وقتی `data.disabled === true` شد:
  - پیام Toast واضح‌تر و قابل اقدام شود (مثلاً «تنظیمات Odoo فعال نیست یا مقدار نامعتبر است»).
  - از ابهام جلوگیری شود تا کاربر وارد loop خطا نشود.

5) اعتبارسنجی نهایی End-to-End  
- اجرای Sync از `/pipeline` و بررسی:
  - دیگر Toast قرمز `Odoo Sync Disabled` نمایش داده نشود.
  - `odoo-crm-sync` پاسخ عملیاتی بدهد (created/updated/reconciled).
  - سپس `odoo-chatter-sync` اجرا شود و داده‌های Chatter/Activities/Timeline بروزرسانی شوند.
- بررسی شبکه: پاسخ‌ها باید از حالت `disabled:true` خارج شوند.

جزئیات فنی (خلاصه):
- علت اصلی: وابستگی به string exact-match برای env flag در چند endpoint.
- راه‌حل پایدار: parsing مقاوم + reuse مشترک + logging تشخیصی.
- اثر جانبی مثبت: این اصلاح همه مسیرهای Odoo را همزمان پایدار می‌کند، نه فقط Sync اصلی.
