

# ارتقا به آخرین مدل ChatGPT (GPT-5) برای حداکثر دقت

## مشکل فعلی
مدل فعلی `gpt-5-mini` است — سریع ولی دقت کمتر از مدل اصلی. در اسکرین‌شات هم متن بنگالی (`আমি...`) فیلتر نشده.

## تغییرات

### 1. `supabase/functions/translate-message/index.ts`
- تغییر model از `gpt-5-mini` به **`gpt-5`** — آخرین و دقیق‌ترین مدل ChatGPT
- افزایش `maxTokens` به `500` برای ترجمه‌های کامل‌تر
- بهبود prompt: تاکید بیشتر روی دقت و حفظ معنای دقیق

### 2. `src/hooks/useAzinVoiceRelay.ts` — فیلتر نویز بهتر
- فیلتر حداقل حروف معنادار (letter ratio) از 0.5 به 0.6 برای حذف بهتر نویز
- اطمینان از اینکه متن‌های غیر فارسی/انگلیسی (مثل بنگالی در اسکرین‌شات) فیلتر می‌شوند

### فایل‌ها
- `supabase/functions/translate-message/index.ts` — مدل GPT-5
- `src/hooks/useAzinVoiceRelay.ts` — فیلتر دقیق‌تر

