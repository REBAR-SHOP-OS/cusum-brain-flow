

# بهبود دقت شنیداری، سرعت ترجمه، و حذف کامل خروجی در سکوت

## مشکلات فعلی (از اسکرین‌شات)

1. **"(speaking in foreign language)..."** — Scribe هنگام سکوت یا صدای نامشخص این متن را تولید می‌کند
2. سرعت ترجمه می‌تواند بهتر شود

## تغییرات

### 1. `src/hooks/useAzinVoiceRelay.ts` — فیلتر قوی‌تر + سرعت

**فیلتر سکوت/نویز:**
- بلاک کردن متن‌هایی که با پرانتز شروع می‌شوند: `(speaking in foreign language)`, `(music)`, `(laughter)` — اینها annotation های Scribe هستند، نه گفتار واقعی
- بلاک کردن متن‌هایی که فقط نقطه‌گذاری هستند (مثل `...`)
- حفظ فیلتر ۳ کلمه / ۸ کاراکتر برای جلوگیری از نویز کوتاه

**حذف partial text نویزی:**
- اگر partial text حاوی `(speaking` یا `(music` باشد، نمایش ندهد

### 2. `supabase/functions/translate-message/index.ts` — مدل سریع‌تر

- تغییر مدل از `gemini-3-flash-preview` به `gemini-2.5-flash` — پایدارتر و سریع‌تر
- کاهش temperature از 0.0 به 0.0 (همان — حداکثر دقت)
- اضافه کردن `maxTokens: 500` برای پاسخ سریع‌تر

### فایل‌ها
- `src/hooks/useAzinVoiceRelay.ts`
- `supabase/functions/translate-message/index.ts`

