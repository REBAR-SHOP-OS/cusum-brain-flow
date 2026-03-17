

## مشکل: جابجایی ابعاد (Dimensions) در استخراج — مقادیر H در G، K در J و غیره

### ریشه مشکل
در استاندارد میلگرد، ستون‌های ابعاد از حرف **"I" رد می‌شوند** و مستقیم از H به J می‌روند: `A, B, C, D, E, F, G, H, J, K, O, R`. اما بسیاری از سند‌های منبع (اکسل/PDF) ستون "I" را دارند. وقتی AI با یک ستون "I" مواجه می‌شود، چون در schema خروجی ما "I" وجود ندارد، مقادیر را جابجا می‌کند — مثلاً مقدار واقعی H را در G قرار می‌دهد.

### راه‌حل — سه تغییر

**1. `supabase/functions/extract-manifest/index.ts` — بهبود prompt AI**
- اضافه کردن دستور صریح به system prompt:
  - "IMPORTANT: Rebar dimension columns skip letter 'I'. They go A, B, C, D, E, F, G, H, J, K, O, R. There is NO 'I' dimension. If the source document has an 'I' column, IGNORE it completely. Do NOT shift other dimension values."
- اضافه کردن فیلد `"I"` به JSON schema خروجی (با توضیح "always null, ignore") تا AI بتواند مقدار ستون I منبع را جایی بگذارد بدون جابجا کردن بقیه

**2. `supabase/functions/extract-manifest/index.ts` — post-processing**
- در mapping ردیف‌ها (خطوط 344-373)، اگر AI مقدار `item.I` برگرداند، آن را نادیده بگیر (log warning)
- اطمینان از اینکه `item.H`, `item.J`, `item.K` مستقیم به `dim_h`, `dim_j`, `dim_k` مپ می‌شوند (این قسمت درست است، فقط باید مطمئن شویم AI خودش مقادیر را جابجا نکرده)

**3. `src/components/office/BarlistMappingPanel.tsx` — پشتیبانی از "I"**
- اضافه کردن `"i": "dim_j"` یا بهتر، یک warning/ignore برای ستون I در HEADER_ALIASES

### فایل‌ها
- `supabase/functions/extract-manifest/index.ts` — prompt fix + post-processing
- `src/components/office/BarlistMappingPanel.tsx` — header alias برای "i"

