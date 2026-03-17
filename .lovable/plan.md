

## مشکل: "Odoo sync failed — Failed to send a request to the Edge Function"

### ریشه مشکل
فراخوانی `supabase.functions.invoke("odoo-crm-sync")` با 2898 لید Odoo حدود 3 دقیقه طول می‌کشد. SDK سوپابیس timeout پیش‌فرض ندارد ولی مرورگر یا gateway اتصال را قطع می‌کند و خطای "Failed to send a request to the Edge Function" ظاهر می‌شود. سرور sync را کامل انجام می‌دهد ولی کلاینت جواب را دریافت نمی‌کند.

### راه‌حل
`supabase.functions.invoke` را با `invokeEdgeFunction` (ابزار موجود پروژه که timeout و retry دارد) جایگزین کنیم — با timeout بالا (180 ثانیه) برای sync سنگین.

### تغییرات

**`src/pages/Pipeline.tsx` — خط 635**
- جایگزینی `supabase.functions.invoke("odoo-crm-sync", ...)` با `invokeEdgeFunction("odoo-crm-sync", { mode: "full" }, { timeoutMs: 180000 })`
- همینطور برای `odoo-chatter-sync` (خط 651) — timeout 120 ثانیه
- حذف بررسی جداگانه `error` چون `invokeEdgeFunction` خودش خطا throw می‌کند
- Import اضافه: `import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction"`

**`src/components/pipeline/LeadDetailDrawer.tsx` — خط 104**
- همان تغییر برای sync تکی (timeout پیش‌فرض 30 ثانیه کافی است)

### فایل‌ها
- `src/pages/Pipeline.tsx`
- `src/components/pipeline/LeadDetailDrawer.tsx`

