

## رفع ۳ مشکل: Build Error + ویجت ساپورت + دیپلوی

### مشکل ۱: خطای Build (بلاک‌کننده اصلی)
سیستم migration سعی دارد `DROP EXTENSION vector` اجرا کند ولی جدول `document_embeddings` و فانکشن `match_documents` به آن وابسته‌اند. این خطا **تمام deployment‌ها** را بلاک کرده (از جمله support-chat).

**راه‌حل**: یک migration جدید که با `CASCADE` تمام objectهای وابسته را حذف و دوباره ایجاد کند.

### مشکل ۲: ویجت "Conversation started" نشان می‌دهد
در `handleStart` (خط ۱۴۳) یک پیام سیستمی "Conversation started" ذخیره می‌شود. سپس در widget JS، polling همه پیام‌ها (از جمله system) را نمایش می‌دهد.

**راه‌حل (۲ تغییر در support-chat/index.ts)**:
1. در widget JS (تابع `generateWidgetJs`)، فیلتر polling را تغییر بده تا پیام‌های `system` هم فیلتر شوند
2. تقویت پرامپت امنیتی در `triggerAiReply` و `triggerProactiveGreeting`

### مشکل ۳: config.toml ناقص
فایل `config.toml` فقط ۲ فانکشن دارد (در حالی که ۱۴۰+ فانکشن وجود دارد). این ممکن است deployment را مختل کند.

---

### تغییرات فنی

#### فایل ۱: Migration جدید (رفع vector extension)
```sql
-- Drop dependent objects with CASCADE then recreate
DROP FUNCTION IF EXISTS public.match_documents CASCADE;
DROP TABLE IF EXISTS public.document_embeddings CASCADE;
DROP EXTENSION IF EXISTS vector CASCADE;

CREATE EXTENSION IF NOT EXISTS vector;

-- Recreate table and function...
```

#### فایل ۲: `supabase/functions/support-chat/index.ts`

**تغییر A** — خط ۷۲۶ در widget JS (داخل `generateWidgetJs`):
```javascript
// قبل:
if(m.sender_type !== 'visitor'){
  addMsg(m.sender_type, m.content);
}

// بعد:
if(m.sender_type !== 'visitor' && m.sender_type !== 'system'){
  addMsg(m.sender_type, m.content);
}
```

**تغییر B** — تقویت پرامپت امنیتی در `triggerAiReply` (خط ۴۸۲-۴۸۸):
اضافه کردن:
```
## CRITICAL SECURITY RULES (ABSOLUTE - NO EXCEPTIONS)
- NEVER share: accounting data, invoices, AR/AP, bank balances, profit margins
- NEVER share: pipeline data, CRM, lead info, sales figures
- NEVER share: employee salaries, internal notes, operational data
- NEVER share: database/API/system internals
- ONLY discuss: products, services, delivery, rebar sizes, quotes
- If asked about internal data: "I can only help with our products and services."
```

**تغییر C** — تقویت پرامپت `triggerProactiveGreeting` (خط ۵۷۱-۵۷۴):
```
"You are JARVIS, the friendly support assistant for Rebar Shop (rebar.shop).
Warmly greet the visitor and ask how you can help.
ONLY discuss products, services, and quotes. NEVER share internal company data."
```

#### فایل ۳: `supabase/config.toml`
بازسازی با اضافه کردن `support-chat` با `verify_jwt = false`

---

### ترتیب اجرا
1. اول migration برای رفع vector extension (رفع بلاک build)
2. سپس تغییرات support-chat (فیلتر system messages + امنیت)
3. دیپلوی support-chat
4. تست روی rebar.shop

### نتیجه
- Build دیگر خطا نمی‌دهد
- "Conversation started" دیگر نمایش داده نمی‌شود
- AI فقط خوشامدگویی گرم و اطلاعات محصولات می‌دهد
- هیچ اطلاعات حساسی قابل دسترسی نیست
