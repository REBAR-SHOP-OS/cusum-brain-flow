

# رفع خطای "Failed to send a request to the Edge Function" در ایجنت Pixel

## علت ریشه‌ای
تولید تصویر در Pixel حدود ۶۰ ثانیه طول می‌کشد، اما timeout کلاینت ۵۵ ثانیه است. وقتی AbortController فعال می‌شود، Supabase SDK خطای "Failed to send a request to the Edge Function" برمی‌گرداند — نه خطای واقعی از سمت سرور.

## تغییرات

### ۱. فایل: `src/lib/agent.ts`
- افزایش timeout از `55_000` (55 ثانیه) به `120_000` (120 ثانیه) برای اینکه تولید تصویر فرصت کافی داشته باشد
- بهبود پیام خطای timeout برای وضوح بیشتر

### ۲. فایل: `src/pages/AgentWorkspace.tsx`
- بهبود پیام خطا: اگر خطا شامل "Failed to send" یا "aborted" باشد، پیام واضح‌تری نشان دهد (مثلاً "تولید تصویر بیش از حد طول کشید، لطفاً دوباره تلاش کنید")

### جزییات فنی

```typescript
// src/lib/agent.ts — خط ۴۳
// قبل:
const timeoutId = setTimeout(() => controller.abort(), 55_000);
// بعد:
const timeoutId = setTimeout(() => controller.abort(), 120_000);
```

```typescript
// src/pages/AgentWorkspace.tsx — خط ۲۸۶
// بهبود پیام خطا برای حالت timeout/abort
const errText = error instanceof Error ? error.message : "Unknown error";
const friendlyMsg = /abort|timeout|failed to send/i.test(errText)
  ? "Image generation is taking longer than expected. Please try again."
  : errText;
```

## فایل‌های تغییر
1. `src/lib/agent.ts` — افزایش timeout به ۱۲۰ ثانیه
2. `src/pages/AgentWorkspace.tsx` — پیام خطای بهتر برای timeout

