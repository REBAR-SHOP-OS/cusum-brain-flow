

## Plan: Make AI Prompt Match Selected Duration Exactly

### Problem
کاربر duration `15s` انتخاب کرده اما AI یک ad script برای **30 ثانیه** نوشته ("Here's a 30-second ad script..."). پرامت باید **دقیقاً** بر اساس duration انتخابی نوشته شود.

### Root Cause
در `ChatPromptBar.tsx` تابع `buildContextString()` فقط `Duration: 15s` را به عنوان یک chip ساده در لیست انتخاب‌ها می‌فرستد. این به اندازه کافی صریح نیست — AI آن را نادیده می‌گیرد و duration پیش‌فرض خودش (معمولاً 30s) را استفاده می‌کند. علاوه بر این، system prompt در edge function `ad-director-ai` (action: write-script) دستور سختگیرانه‌ای برای رعایت duration ندارد.

### Fix (Surgical, 1 file)

**`src/components/ad-director/ChatPromptBar.tsx`** — فقط `buildContextString()`:

اضافه کردن یک بلاک **DURATION CONSTRAINT** صریح و تأکیدی در input که AI نتواند نادیده بگیرد:

```
DURATION CONSTRAINT (CRITICAL — MUST OBEY):
- Total video length: EXACTLY {duration} seconds
- Do NOT write a script longer or shorter than {duration}s
- Do NOT mention any other duration (e.g., never say "30-second ad" if user picked 15s)
- Pace visuals, voiceover, and scene count to fit within {duration}s
- Approximate spoken word budget: ~{duration * 2.5} words max for voiceover
- Scene count guidance: ~1 scene per 5 seconds (so {duration}s ≈ {Math.ceil(duration/5)} scenes)
```

این بلاک قبل از `USER SELECTIONS` و بعد از `BRAND` block قرار می‌گیرد، با تأکید CRITICAL/MUST OBEY که AI آن را نادیده نگیرد.

### What Stays the Same
- Edge function `ad-director-ai` — بدون تغییر
- Dialog UI، chips، Regenerate، Use this prompt — بدون تغییر
- Brand block (rebar.shop) — بدون تغییر، فقط duration block بعد از آن اضافه می‌شود
- بقیه handlerها و textarea اصلی — بدون تغییر

### Result
کاربر duration `15s` انتخاب می‌کند → کلیک روی AI Prompt → پرامت تولیدشده **دقیقاً** برای 15 ثانیه نوشته می‌شود (نه 30s)، با scene count و word budget متناسب با همان زمان. اگر کاربر duration را به 8s یا 30s تغییر دهد و Regenerate بزند، پرامت جدید با همان duration هماهنگ خواهد بود.

