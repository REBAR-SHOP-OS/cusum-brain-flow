

## اتصال واقعی انتخاب‌گر مدل (Gemini/ChatGPT) به بک‌اند

### مشکل فعلی
انتخاب‌گر مدل در Pixel (Gemini / ChatGPT) فقط ظاهری است. وقتی کاربر ChatGPT را انتخاب می‌کند، بک‌اند همچنان از Gemini استفاده می‌کند. دلیل: مقدار `aiModel` هرگز به تابع `sendAgentMessage` و سپس به Edge Function ارسال نمی‌شود.

### راه‌حل
زنجیره کامل انتقال مدل انتخابی از UI تا بک‌اند:

### ۱. فایل: `src/lib/agent.ts`
- اضافه کردن پارامتر `preferredModel?: string` به تابع `sendAgentMessage`
- ارسال آن در بدنه درخواست به Edge Function:

```text
body: { agent, message, history, context, attachedFiles, pixelSlot, preferredModel }
```

### ۲. فایل: `src/pages/AgentWorkspace.tsx`
- ارسال `aiModel` به `sendAgentMessage` در `handleSendInternal`:

```text
const response = await sendAgentMessage(
  config.agentType, content, history, extraContext, attachedFiles, slotOverride, aiModel
);
```

### ۳. فایل: `supabase/functions/ai-agent/index.ts`
- دریافت `preferredModel` از بدنه درخواست
- اگر `preferredModel` مشخص باشد، از آن به جای `selectModel` خودکار استفاده شود:

```text
// اگر کاربر مدل انتخاب کرده، از آن استفاده کن
if (preferredModel === "chatgpt") {
  modelConfig = { provider: "gpt", model: "gpt-4o", maxTokens: 4000, temperature: 0.5 };
} else if (preferredModel === "gemini") {
  modelConfig = { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 4000, temperature: 0.5 };
} else {
  modelConfig = selectModel(agent, message, ...);
}
```

- همچنین در `generateDynamicContent` (تولید کپشن Pixel)، مدل انتخابی را منتقل کن تا کپشن هم با همان مدل تولید شود
- مپینگ مدل‌ها:
  - `"gemini"` → `provider: "gemini"`, `model: "gemini-2.5-flash"` (پیش‌فرض فعلی)
  - `"chatgpt"` → از Lovable AI Gateway با `model: "openai/gpt-5-mini"` (چون پروژه از GPT_API_KEY مستقیم و هم از Lovable Gateway استفاده می‌کند)

### ۴. فایل: `supabase/functions/ai-agent/index.ts` — تابع `generateDynamicContent`
- اضافه کردن پارامتر `preferredModel` به تابع
- اگر `chatgpt` انتخاب شده باشد، مدل Lovable Gateway را به `openai/gpt-5-mini` تغییر بده
- اگر `gemini` باشد، از `google/gemini-2.5-flash` فعلی استفاده کن

### نکته مهم: دوگانگی API
- پروژه از دو سیستم AI استفاده می‌کند:
  1. **aiRouter مستقیم** (`callAI`) — با GPT_API_KEY و GEMINI_API_KEY مستقیماً با OpenAI/Google صحبت می‌کند
  2. **Lovable AI Gateway** — برای `generateDynamicContent` از Gateway استفاده می‌شود
- برای ChatGPT: در `callAI` از `provider: "gpt"` و در Gateway از `openai/gpt-5-mini` استفاده می‌شود
- برای Gemini: در `callAI` از `provider: "gemini"` و در Gateway از `google/gemini-2.5-flash` استفاده می‌شود

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `src/lib/agent.ts` | اضافه شدن پارامتر `preferredModel` |
| `src/pages/AgentWorkspace.tsx` | ارسال `aiModel` به `sendAgentMessage` |
| `supabase/functions/ai-agent/index.ts` | استفاده از `preferredModel` در مسیریابی مدل + generateDynamicContent |

### نتیجه
- وقتی Gemini انتخاب شود → واقعاً Gemini 2.5 Flash استفاده می‌شود
- وقتی ChatGPT انتخاب شود → واقعاً GPT (OpenAI) استفاده می‌شود
- هم چت اصلی و هم تولید محتوای Pixel از مدل انتخابی کاربر استفاده می‌کنند
