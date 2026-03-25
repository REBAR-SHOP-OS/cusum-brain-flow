

## بهبود گزارش آیزنهاور + دکمه پایان چت

### هدف
1. گزارش نهایی باید سطح CEO باشد — جامع، دقیق، حرفه‌ای
2. دکمه "Finalize Day" در پایین چت اضافه شود که وقتی کاربر کلیک کند، یک پیام تشکر نمایش داده شود و چت برای آن روز قفل شود

### تغییرات

#### 1. بهبود prompt گزارش — `supabase/functions/_shared/agents/growth.ts`
بخش `REPORT QUALITY` را به‌روز می‌کنیم تا گزارش نهایی:
- عنوان رسمی داشته باشد: "Eisenhower Matrix Report — CEO Briefing"
- بخش Executive Summary با ارزیابی عملکرد کارمند و ریسک‌های کلیدی
- هر تسک با جزئیات کامل: دلیل، ریسک تأخیر، پیشنهاد اجرایی، زمان‌بندی، مسئول
- بخش "Employee Performance Assessment" اضافه شود
- بخش "Red Flags for CEO Attention" اضافه شود
- لحن رسمی و مناسب گزارش‌دهی به مدیرعامل

#### 2. دکمه Finalize Day — `src/pages/AgentWorkspace.tsx`
- یک state `sessionFinalized` اضافه شود
- وقتی کاربر روی دکمه "Finalize Day ✅" کلیک کند:
  - پیام سیستمی تشکر به چت اضافه شود (به زبان کاربر، fallback انگلیسی)
  - `sessionFinalized = true` شود
  - `ChatInput` غیرفعال (disabled) شود با پیام "This day has been finalized"
  - در `chat_sessions` یک فیلد metadata یا status ذخیره شود
- وقتی session قبلی لود می‌شود، اگر finalized باشد input غیرفعال بماند

#### 3. Migration — اضافه کردن فیلد `is_finalized` به `chat_sessions`
```sql
ALTER TABLE public.chat_sessions ADD COLUMN is_finalized boolean DEFAULT false;
```

#### 4. بررسی finalized هنگام لود session
در `AgentWorkspace.tsx` وقتی session قبلی انتخاب می‌شود، اگر `is_finalized = true` بود، input غیرفعال شود.

### فایل‌های درگیر
- `supabase/functions/_shared/agents/growth.ts` — بهبود prompt برای گزارش CEO-level
- `src/pages/AgentWorkspace.tsx` — دکمه Finalize + state مدیریت قفل
- Migration: اضافه کردن ستون `is_finalized` به `chat_sessions`

