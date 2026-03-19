

# بهبود سرعت، صدای زنانه، و فیلتر نویز قوی‌تر

## تغییرات

### 1. `src/hooks/useAzinVoiceRelay.ts` — صدای زنانه + سرعت + فیلتر قوی‌تر

**صدا**: هر دو صدا زنانه شوند:
- انگلیسی: **Sarah** (`EXAVITQu4vr4xnSDxMaL`) — multilingual v2
- فارسی: **Sarah** (همان voice، multilingual v2 فارسی هم ساپورت می‌کند)

**سرعت**: پارامتر `speed: 1.1` به TTS request اضافه شود (10% سریع‌تر بدون خرابی کیفیت)

**فیلتر نویز قوی‌تر** برای جلوگیری از نوشتن متن الکی:
- حداقل **3 کلمه** (به جای 2) و حداقل **8 کاراکتر** (به جای 5)
- بلاک‌لیست کلمات تکراری و بی‌معنی (مثل "yeah yeah", "hmm", تکرار حروف)
- تشخیص زبان‌های غیر فارسی/انگلیسی (مثل تامیل در اسکرین‌شات) و حذف آن‌ها — اگر متن حاوی حروف فارسی/عربی یا لاتین نباشد، نادیده گرفته شود

### 2. `supabase/functions/elevenlabs-tts/index.ts` — مدل سریع‌تر

- تغییر مدل TTS از `eleven_multilingual_v2` به `eleven_turbo_v2_5` — لیتنسی کمتر، کیفیت خوب
- `speed` پارامتر از کلاینت دریافت شود (پیش‌فرض 1.0)

### فایل‌ها
- `src/hooks/useAzinVoiceRelay.ts` — voice IDs، speed، noise filter
- `supabase/functions/elevenlabs-tts/index.ts` — مدل turbo

