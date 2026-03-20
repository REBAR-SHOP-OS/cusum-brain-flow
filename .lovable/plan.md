

## بررسی و بهبود سرعت و دقت ترجمه Nila

### وضعیت فعلی

الان `translate-message` از مدل **`gemini-2.5-flash`** استفاده می‌کند (از طریق Google Gemini API مستقیم، نه Lovable AI Gateway). قبلا از `gemini-2.5-pro` استفاده می‌شد ولی بخاطر refusal (رد کردن محتوا) عوض شد.

### مشکل

- **دقت**: `gemini-2.5-flash` سریع‌تر ولی دقتش از Pro کمتره، مخصوصا برای فارسی محاوره‌ای
- **سرعت**: هر بار یک HTTP round-trip کامل به Google API انجام می‌شه. temperature 0.3 هم باعث می‌شه مدل کمی بیشتر فکر کنه

### تغییرات پیشنهادی

**1. ارتقای مدل به `gemini-2.5-pro` با حفظ anti-refusal prompt**

File: `supabase/functions/translate-message/index.ts`

- تغییر مدل از `gemini-2.5-flash` به `gemini-2.5-pro` برای بالاترین دقت ترجمه
- prompt ضد-refusal که قبلا اضافه شده (rule 10) جلوی مشکل قبلی رو می‌گیره
- کاهش `temperature` از `0.3` به `0.1` برای ترجمه دقیق‌تر و سریع‌تر (کمتر فکر کردن)

**2. کاهش `maxTokens` از 500 به 300**

ترجمه‌های realtime معمولا کوتاه هستن. کمتر بودن maxTokens = پاسخ سریع‌تر.

**3. حذف context section برای سرعت بیشتر (اختیاری)**

Context بخش اضافه‌ای به prompt اضافه می‌کنه که latency رو بالا می‌بره. می‌تونیم محدودش کنیم به 1 segment بجای 3.

### خلاصه تغییرات

| پارامتر | قبل | بعد |
|---------|------|------|
| مدل | `gemini-2.5-flash` | `gemini-2.5-pro` |
| Temperature | 0.3 | 0.1 |
| maxTokens | 500 | 300 |
| Context buffer | 3 segments | 1 segment |

### فایل‌های تغییر

- `supabase/functions/translate-message/index.ts` — مدل، temperature، maxTokens

