

## تحلیل مشکل "Error rejecting item"

### یافته‌ها
1. **پالیسی‌های RLS اصلاح شدند** — تایید شد که `p.user_id = auth.uid()` در دیتابیس اعمال شده.
2. **علت اصلی خطا**: لاگ‌های احراز هویت نشان می‌دهند که JWT کاربر روی `cusum-brain-flow.lovable.app` نامعتبر/منقضی شده (`bad_jwt`, `missing sub claim`). یعنی backend درخواست‌ها را رد می‌کند.
3. **چرا لیست نمایش داده می‌شود ولی عملیات خطا می‌دهد**: آیتم‌های پیش‌فرض از آرایه `COMPANY_DEFAULTS` (hardcoded) رندر می‌شوند، نه از دیتابیس. بنابراین حتی اگر SELECT خالی برگردد، آیتم‌ها نمایش داده می‌شوند. اما INSERT/DELETE با JWT نامعتبر شکست می‌خورد.

### تغییرات پیشنهادی

**1. بهبود پیام خطا** (`src/hooks/usePurchasingList.ts`):
- در توابع `addItemAsRejected`، `addItemAsPurchased`، `toggleRejected`، `togglePurchased`: پیام خطای واقعی Supabase را در toast نمایش بده تا کاربر بداند مشکل چیست (مثلاً "JWT expired").

**2. بررسی معتبر بودن session قبل از عملیات**:
- اگر `user` وجود دارد ولی session نامعتبر است، یک refresh token انجام شود یا کاربر به login هدایت شود.

**3. اولین قدم فوری**:
- کاربر باید **logout و login مجدد** کند تا JWT تازه دریافت کند. پالیسی‌ها اصلاح شده‌اند و پس از login مجدد باید کار کنند.

### فایل‌های تغییر
- `src/hooks/usePurchasingList.ts` — بهبود پیام خطاها با نمایش `error.message`

