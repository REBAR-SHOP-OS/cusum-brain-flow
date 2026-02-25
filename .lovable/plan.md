

## سه اصلاح: حذف تکرار در Content + جابجایی ترجمه فارسی + تقویت لوگو

### مشکل ۱: تکراری شدن متن در بخش Content (سوشیال مدیا منیجر)
در اسکرین‌شات مشخص است که `title` و `content` هر دو همان متن کپشن را نشان می‌دهند. دلیل: در `AgentWorkspace.tsx` هنگام Approve، `title` از اولین خط `caption` ساخته می‌شود و `content` هم همان `caption` کامل است. در `PostReviewPanel.tsx` خط ۲۷۴-۲۷۷ هر دو نمایش داده می‌شوند.

**راه‌حل**: در `AgentWorkspace.tsx`، `title` را یک عنوان کوتاه و معنادار بسازیم (مثلاً نام محصول یا اولین ۵۰ کاراکتر بدون ایموجی) و از `content` جدا باشد. همچنین اگر `title` زیرمجموعه‌ای از `content` بود، آن را از `content` حذف کنیم تا تکرار نشود.

### مشکل ۲: ترجمه فارسی باید زیر دکمه‌های Approve/Regenerate باشد
در `PixelPostCard.tsx` فعلی، بخش `persianTranslation` بین هشتگ‌ها و دکمه‌ها قرار دارد (خط ۶۱-۶۸). کاربر می‌خواهد **زیر** دکمه‌ها نمایش داده شود.

**راه‌حل**: بلوک `persianTranslation` را از بخش Caption+Hashtags (خط ۶۱-۶۸) به بعد از بلوک Action icons (بعد از خط ۹۸) منتقل می‌کنیم.

### مشکل ۳: لوگو در تولید تصویر
کد فعلی در `ai-agent/index.ts` لوگو را از `knowledge` table یا fallback path پیدا می‌کند و به مدل AI ارسال می‌کند. اما attempt اول با `useLogo: true` است و اگر fail شود، attempt های بعدی بدون لوگو هستند. باید همه attempt ها با لوگو باشند.

**راه‌حل**: در `generatePixelImage` (خط ۱۷۷-۱۸۱)، همه attempt ها را `useLogo: true` کنیم تا لوگو همیشه ارسال شود. همچنین prompt تقویت شود.

---

### تغییرات فایل‌ها

| فایل | تغییر |
|------|-------|
| `src/components/social/PixelPostCard.tsx` | انتقال بلوک ترجمه فارسی به **زیر** دکمه‌های Approve/Regenerate |
| `src/pages/AgentWorkspace.tsx` | اصلاح ساخت `title`: استخراج عنوان کوتاه و حذف تکرار با content |
| `supabase/functions/ai-agent/index.ts` | تغییر همه attempt ها به `useLogo: true` |

### جزییات فنی

**PixelPostCard.tsx — جابجایی ترجمه فارسی:**
بلوک `persianTranslation` (خطوط ۶۱-۶۸) حذف شده و بعد از بلوک Action icons (بعد از خط ۹۸ — بعد از `</div>` دکمه‌ها) اضافه می‌شود.

**AgentWorkspace.tsx — رفع تکرار title/content:**
```text
// Extract a short title: first emoji-free meaningful phrase, max 50 chars
const lines = cleanCaption.split("\n").filter(l => l.trim().length > 0);
const titleLine = lines[0] || "Pixel Post";
// Remove emoji prefix for cleaner title
const title = titleLine.replace(/^[\p{Emoji}\s]+/u, "").slice(0, 50) || "Pixel Post";
// Content: if title is same as first line, remove it to avoid duplication
const content = cleanCaption.startsWith(titleLine) 
  ? cleanCaption.slice(titleLine.length).trim() || cleanCaption
  : cleanCaption;
```

**ai-agent/index.ts — لوگو اجباری:**
```text
const attempts = [
  { model: "google/gemini-2.5-flash-image", useLogo: true },
  { model: "google/gemini-2.5-flash-image", useLogo: true },   // was false
  { model: "google/gemini-3-pro-image-preview", useLogo: true }, // was false
];
```
