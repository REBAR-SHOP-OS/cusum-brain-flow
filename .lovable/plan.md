

# سرعت و دقت بیشتر + حذف Hey Nila + فیلتر سکوت

## تغییرات

### 1. `supabase/functions/translate-message/index.ts` — مدل GPT-5-mini
- تغییر provider از `gemini` به `gpt` و model به `gpt-5-mini` (سریع‌ترین مدل ChatGPT با دقت بالا)
- اضافه کردن `maxTokens: 300` برای پاسخ سریع‌تر

### 2. `src/hooks/useAzinVoiceRelay.ts` — فیلتر سکوت قوی‌تر
- بلاک کردن متن‌هایی که با `(` شروع می‌شوند — مثل `(speaking in foreign language)` که Scribe هنگام سکوت تولید می‌کند
- بلاک کردن partial text حاوی annotation (نمایش ندادن)
- افزایش `stability` به `0.65` و `similarity_boost` به `0.85` برای صدای واضح‌تر

### 3. `src/pages/AzinInterpreter.tsx` — حذف کامل Hey Nila
- حذف useEffect مربوط به wake-word detection (خطوط 49-61)

### فایل‌ها
- `supabase/functions/translate-message/index.ts`
- `src/hooks/useAzinVoiceRelay.ts`
- `src/pages/AzinInterpreter.tsx`
- `supabase/functions/elevenlabs-tts/index.ts` — stability/similarity بالاتر

