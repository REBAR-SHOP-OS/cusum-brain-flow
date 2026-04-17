

## Plan: AI Prompt Preview Dialog Based on Selected Chips

### Problem
کاربر می‌خواهد وقتی روی «AI Prompt» کلیک می‌کند:
1. یک **صفحه (دیالوگ)** باز شود که پرامت تولیدشده توسط AI را **نمایش دهد** (نه اینکه مستقیم در textarea بیفتد)
2. پرامت تولیدشده باید **حتماً** بر اساس انتخاب‌های کاربر در chipها باشد — یعنی **Style** و **Products** و **Duration** و **Ratio** و **Engine** را در نظر بگیرد
3. کاربر بتواند پرامت را در آن دیالوگ ببیند، ادیت کند، و بعد تأیید/استفاده کند

### Current State
- کلیک روی «AI Prompt» → `handleAiWrite` → edge function `ad-director-ai` با `action: "write-script"` صدا زده می‌شود → نتیجه مستقیم در textarea اصلی می‌نشیند
- chip context (style/products/duration/ratio/engine) به edge function ارسال می‌شود اما کاربر نمی‌بیند چه پرامتی تولید شده تا تأییدش کند

### Changes (Surgical, Additive)

**1. `src/components/ad-director/ChatPromptBar.tsx`**
- اضافه کردن state جدید: `previewOpen`, `previewText`, `editablePreview`
- در `handleAiWrite`: به جای `setPrompt(result.text)` مستقیم، نتیجه را در `previewText` قرار می‌دهیم و `previewOpen=true` می‌کنیم
- اضافه کردن render یک دیالوگ جدید (یا استفاده مجدد از `AIPromptDialog` با تغییر mode به "preview") که نمایش می‌دهد:
  - **Header**: "AI Prompt Preview" + Sparkles icon
  - **Context chips**: نمایش chipهای استفاده‌شده (Style: X, Products: Y, Duration: Z, Ratio: W, Engine: V) تا کاربر مطمئن شود انتخاب‌هایش لحاظ شده
  - **Editable textarea**: متن پرامت تولیدشده (قابل ویرایش)
  - **Footer buttons**: 
    - `Regenerate` (دوباره با همان context صدا بزن)
    - `Cancel` (دیالوگ بسته شود، textarea اصلی دست‌نخورده بماند)
    - `Use this prompt` (متن ادیت‌شده در textarea اصلی قرار گیرد و دیالوگ بسته شود)

**2. `src/components/ad-director/AIPromptDialog.tsx`** (reuse فایل موجود)
- این فایل قبلاً برای ورودی کاربر بود و الان unused است
- بازنویسی به یک کامپوننت preview/edit:
  - props: `open`, `onClose`, `text`, `onTextChange`, `onUse`, `onRegenerate`, `regenerating`, `contextChips`
  - نمایش chipهای context در بالا (read-only badges)
  - textarea برای ویرایش پرامت
  - سه دکمه: Regenerate / Cancel / Use this prompt

**3. Backend (`supabase/functions/ad-director-ai/index.ts`)**
- بدون تغییر — قبلاً chip context را در `input` می‌گیرد و خروجی پرامت سینمایی می‌دهد
- فقط مطمئن می‌شویم در `handleAiWrite` تمام chip selectionها به صورت structured در `contextString` گنجانده شوند (style label, product names, duration, ratio, engine)

### Investigation Step Before Coding
قبل از کدنویسی این فایل را می‌خوانم تا ساختار دقیق `handleAiWrite` و chip stateها را تأیید کنم:
- `src/components/ad-director/ChatPromptBar.tsx` (پیدا کردن exact location of handleAiWrite, chip state vars, و render tree)
- `src/components/ad-director/AIPromptDialog.tsx` (بررسی فعلی برای reuse)

### What Stays the Same
- Edge function `ad-director-ai` — بدون تغییر
- chipها (Style, Products, Duration, Ratio, Engine) و رفتارشان — بدون تغییر
- intro/outro/character upload cards و badgeهای locked — بدون تغییر
- دکمه «Create video» — بدون تغییر
- textarea اصلی — بدون تغییر، فقط بعد از تأیید کاربر در دیالوگ پر می‌شود

### Result
کلیک روی **AI Prompt** → AI با استفاده از **Style + Products + Duration + Ratio + Engine** انتخابی کاربر یک پرامت سینمایی می‌نویسد → **دیالوگ باز می‌شود** و پرامت را نشان می‌دهد همراه با chipهای context → کاربر می‌تواند: ویرایش کند، Regenerate بزند، Cancel کند، یا «Use this prompt» را بزند تا در textarea اصلی قرار گیرد.

