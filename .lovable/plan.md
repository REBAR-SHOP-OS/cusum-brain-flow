

# اتصال به LLM شخصی برای کاهش هزینه

## استراتژی Hybrid (پیشنهاد امن)

agentهای پرمصرف → کلید مستقیم Google Gemini شما  
agentهای کم‌مصرف → همچنان روی Lovable AI Gateway (بدون تغییر)  
Vizzy Voice → کلید مستقیم OpenAI شما (Realtime API)

این روش ~۷۰٪ کاهش هزینه می‌دهد بدون شکستن چیزی.

## مسیر بندی

| Agent | مدل | مسیر جدید |
|-------|-----|-----------|
| **vizzy** (متنی) | gemini-2.5-flash | کلید مستقیم Gemini |
| **vizzy-daily-brief** | gemini-2.5-flash | کلید مستقیم Gemini |
| **vizzy-briefing** (compressor) | gemini-2.5-flash | کلید مستقیم Gemini |
| **vizzy-business-watchdog** | gemini-2.5-flash | کلید مستقیم Gemini |
| **accounting** | gemini-2.5-flash (downgrade از pro) | کلید مستقیم Gemini |
| **estimating** | gemini-2.5-pro | کلید مستقیم Gemini |
| **vizzy-voice** | OpenAI Realtime | کلید مستقیم OpenAI |
| همه agentهای دیگر (shopfloor, support, social, app-help, ad-director, ...) | بدون تغییر | Lovable AI Gateway |

## تغییرات فنی

### ۱) Provider Adapter (آماده، فقط wire کنیم)
فایل `supabase/functions/_shared/providers/geminiAdapter.ts` از قبل وجود دارد ولی استفاده نمی‌شود. wire می‌کنیم به `aiRouter.ts`.

### ۲) Router Logic در `_shared/aiRouter.ts`
اضافه کردن منطق:
```text
if (agentName ∈ HEAVY_AGENTS) {
  if (GEMINI_API_KEY exists) → use GeminiAdapter (direct)
  else → fallback to Lovable Gateway
}
else → use Lovable Gateway (current behavior)
```

لیست HEAVY_AGENTS:
- `vizzy`
- `accounting`
- `estimating`
- `vizzy-watchdog`
- `vizzy-briefing`

### ۳) Accounting Model Downgrade
در همان روتر، اگر agent = accounting و model = pro → اتوماتیک به flash تبدیل شود (مگر در حالت explicit deep_reconcile).

### ۴) Vizzy Voice
فایل `supabase/functions/vizzy-voice/index.ts` (WebRTC bridge) اگر `OPENAI_API_KEY` موجود باشد از آن استفاده کند، در غیر این صورت روی مسیر فعلی بماند.

### ۵) Secret Management
نیاز به دو secret جدید:
- `GEMINI_API_KEY` — از https://aistudio.google.com/app/apikey
- `OPENAI_API_KEY` — از https://platform.openai.com/api-keys (فقط اگر می‌خواهید Voice هم مستقل شود)

اگر فقط Gemini می‌دهید → Voice روی Lovable می‌ماند (بدون مشکل).

### ۶) Observability
- لاگ هر فراخوانی در `ai_usage_log` با ستون جدید `provider_route` (`lovable_gateway` | `direct_gemini` | `direct_openai`) تا بتوانید مصرف و صرفه‌جویی را ببینید.

### ۷) Fallback ایمن
اگر کلید مستقیم خطا داد (۴۰۱، ۴۲۹، timeout) → خودکار به Lovable Gateway برگردد و در لاگ ثبت کند. کاربر هیچ شکستی نمی‌بیند.

## محدوده تغییر

تغییر می‌کند:
- `supabase/functions/_shared/aiRouter.ts` (router logic)
- `supabase/functions/_shared/providers/geminiAdapter.ts` (موجود — wire only)
- `supabase/functions/_shared/providers/openaiAdapter.ts` (موجود — wire only)
- `supabase/functions/vizzy-voice/index.ts` (key picker)
- `ai_usage_log` (ستون `provider_route` اضافه شود)

تغییر **نمی‌کند**:
- هیچ business logic
- هیچ RLS / دیتابیس entity
- هیچ UI
- هیچ یک از ۱۸ agent دیگر

## مراحل اجرا (پس از تایید)

1. درخواست `GEMINI_API_KEY` با add_secret (و اختیاری `OPENAI_API_KEY`)
2. صبر برای ورود کلید توسط شما
3. wire کردن adapterها به router
4. اضافه کردن HEAVY_AGENTS list و logic انتخاب مسیر
5. accounting model downgrade
6. migration برای ستون `provider_route` در `ai_usage_log`
7. تست end-to-end:
   - یک پیام به Vizzy → باید از کلید Gemini مستقیم برود (در لاگ ثبت شود)
   - یک پیام به shopfloor → باید همچنان از Lovable برود
   - شبیه‌سازی خطای کلید Gemini → باید fallback به Lovable کار کند

## اعتبارسنجی

- ✅ Vizzy متنی روی `/intelligence` پاسخ بدهد
- ✅ Daily Brief صبحگاهی build شود
- ✅ Watchdog هر ۱۵ دقیقه اجرا شود (و early-exit اگر تغییر نباشد)
- ✅ Accounting روی Flash پاسخ بدهد
- ✅ بقیه agentها هیچ تغییری حس نکنند
- ✅ در `ai_usage_log` ستون `provider_route` پر شود

## صرفه‌جویی پیش‌بینی شده

بر اساس مصرف ۳۰ روز اخیر شما:
- Vizzy: 41.7M توکن → از Lovable Gateway به مستقیم Gemini ≈ **۷۰٪ ارزان‌تر**
- Accounting: 6.45M توکن (Pro→Flash) → **~۹۰٪ کاهش هزینه این agent**
- بقیه: بدون تغییر

تخمین کلی: حدود **۶۰–۷۵٪ کاهش هزینه AI ماهانه**.

## سوال قبل از شروع

اگر فقط `GEMINI_API_KEY` بدهید → Voice همچنان روی Lovable می‌ماند (که الان هم مشکلی ندارد).  
اگر `OPENAI_API_KEY` هم بدهید → Voice هم مستقل می‌شود.

با تایید شما، در default mode فقط Gemini را wire می‌کنم و درخواست secret می‌فرستم. اگر OpenAI هم می‌خواهید، در پیام تایید بگویید.

