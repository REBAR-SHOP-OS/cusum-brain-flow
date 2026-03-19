

# ریشه‌ای حل کردن مشکل ترجمه: جایگزینی OpenAI Realtime با پایپلاین دقیق

## مشکل اصلی

OpenAI Realtime یک مدل **مکالمه‌ای** است — حتی با سخت‌ترین prompt، باز هم جواب می‌دهد به جای ترجمه. فارسی اشتباه می‌نویسد چون خودش Farsi تولید می‌کند نه اینکه ترجمه کند. هیچ مقدار prompt engineering این مشکل را کاملاً حل نمی‌کند.

## راه‌حل: تغییر معماری AzinInterpreterVoiceChat

جایگزین کردن OpenAI Realtime با پایپلاین سه‌مرحله‌ای اثبات‌شده:

```text
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  ElevenLabs  │───▶│   Gemini     │───▶│  ElevenLabs  │
│  Scribe STT  │    │  Translation │    │     TTS      │
│  (دقیق)      │    │  (دقیق)      │    │  (خوانش)     │
└──────────────┘    └──────────────┘    └──────────────┘
   صدا → متن          متن → ترجمه        ترجمه → صدا
```

**این همان پایپلاینی است که صفحه اصلی Interpreter از آن استفاده می‌کند و درست کار می‌کند.** فقط خروجی TTS اضافه می‌شود.

## تغییرات

### 1. هوک جدید: `useAzinVoiceRelay.ts`
- از `useRealtimeTranscribe` الگو می‌گیرد
- ElevenLabs Scribe برای تشخیص گفتار (دقیق، بدون hallucination)
- `translate-message` edge function برای ترجمه (Gemini — فارسی بسیار دقیق)
- پس از ترجمه، فراخوانی `elevenlabs-tts` برای خواندن ترجمه با صدا
- پخش صدای ترجمه به صورت خودکار
- تشخیص خودکار زبان ورودی (فارسی/انگلیسی) بر اساس حروف RTL

### 2. کامپوننت: `AzinInterpreterVoiceChat.tsx` — بازنویسی
- حذف وابستگی به `useAzinVoiceInterpreter` (OpenAI Realtime)
- استفاده از هوک جدید `useAzinVoiceRelay`
- نمایش: Original (با فونت Vazirmatn برای فارسی) + Translation
- RTL خودکار برای متن فارسی
- نمایش وضعیت: "Listening...", "Translating...", "Speaking..."

### 3. بهبود TTS
- برای ترجمه انگلیسی: صدای George (مرد انگلیسی)
- برای ترجمه فارسی: voice مناسب از ElevenLabs multilingual v2
- پخش non-blocking — نباید ترنسکریپشن بعدی را مسدود کند

### 4. حذف فایل‌های بلااستفاده
- `useAzinVoiceInterpreter.ts` — دیگر استفاده نمی‌شود

## چرا این کار می‌کند

| مشکل فعلی | راه‌حل |
|---|---|
| مدل از خودش حرف می‌زند | Scribe فقط گوش می‌دهد + Gemini فقط ترجمه می‌کند |
| فارسی اشتباه نوشته می‌شود | Gemini فارسی بسیار دقیق‌تر می‌نویسد |
| "Nothing" هنگام سکوت | Scribe هنگام سکوت چیزی تولید نمی‌کند |
| خطا در شنیدن حرف | ElevenLabs Scribe v2 دقت بالاتری دارد |

## فایل‌ها
- **جدید**: `src/hooks/useAzinVoiceRelay.ts`
- **ویرایش**: `src/components/azin/AzinInterpreterVoiceChat.tsx`
- **حذف**: `src/hooks/useAzinVoiceInterpreter.ts`

