

## چرا بعضی فانکشن‌ها در Batch 4 مایگریت نشدند؟

دو دلیل فنی وجود داشت. هر دو **قابل حل** هستند:

---

### ۱. مشکل FormData (`ai-document-import`)

`handleRequest` در خط 86 فقط `req.json()` را parse می‌کند. اما `ai-document-import` از `req.formData()` استفاده می‌کند (برای آپلود فایل). بنابراین wrapper بدنه درخواست را خراب می‌کند.

**راه‌حل:** یک گزینه `parseBody: false` به `HandlerOptions` اضافه شود تا wrapper از parse کردن body صرف‌نظر کند و handler خودش `req.formData()` را صدا بزند.

### ۲. فانکشن‌های بزرگ (monolith)

- `admin-chat`: **2,979 خط**
- `ai-agent`: **1,303 خط**  
- `ad-director-ai`: **762 خط**

اینها صرفاً به دلیل حجم زیاد و ریسک بالای شکستن رفتار فعلی در یک مرحله مایگریت نشدند — نه به دلیل ناسازگاری فنی.

---

### پلن اجرا (بدون شکست)

**مرحله A — پشتیبانی FormData در wrapper**
- افزودن `parseBody?: boolean` به `HandlerOptions` (پیش‌فرض `true`)
- اگر `false` باشد، `body` خالی `{}` پاس داده شود و handler خودش request را parse کند
- مایگریت `ai-document-import` و `elevenlabs-transcribe`

**مرحله B — مایگریت monolith‌ها**
- فقط لایه بیرونی (CORS, auth, client creation) را به wrapper منتقل می‌کنیم
- منطق داخلی بدون تغییر باقی می‌ماند
- ترتیب: `ad-director-ai` (762 خط) → `ai-agent` (1,303 خط) → `admin-chat` (2,979 خط)

### تغییرات فایل‌ها

| فایل | تغییر |
|---|---|
| `_shared/requestHandler.ts` | افزودن `parseBody` option |
| `ai-document-import/index.ts` | مایگریت با `parseBody: false` |
| `elevenlabs-transcribe/index.ts` | مایگریت با `parseBody: false` |
| `ad-director-ai/index.ts` | مایگریت لایه بیرونی |
| `ai-agent/index.ts` | مایگریت لایه بیرونی |
| `admin-chat/index.ts` | مایگریت لایه بیرونی |

