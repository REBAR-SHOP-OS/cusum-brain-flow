

## رفع مشکلات دکمه Regenerate و بهبود ترجمه فارسی

### مشکلات شناسایی‌شده

1. **Regenerate عکس تکراری تولید می‌کند**: وقتی کاربر Regenerate می‌زند، پیام `"Regenerate image and caption for: ..."` به بک‌اند ارسال می‌شود. این پیام با الگوی slot (`^[1-5]$`) مطابقت ندارد، بنابراین از مسیر deterministic رد شده و به LLM می‌رود — که توانایی تولید تصویر واقعی ندارد یا تصویر تکراری تولید می‌کند.

2. **لوگوی شرکت در Regenerate اعمال نمی‌شود**: چون مسیر deterministic فعال نمی‌شود، تابع `generatePixelImage` (که لوگو را شامل می‌کند) صدا زده نمی‌شود.

3. **«متن روی عکس» در ترجمه فارسی**: اگر تصویر متنی نداشته باشد، `imageTextFa` نباید نمایش داده شود.

---

### تغییرات

#### 1. شناسایی پیام Regenerate در بک‌اند (فایل: `supabase/functions/ai-agent/index.ts`)
- یک regex جدید اضافه می‌شود که پیام‌های `"Regenerate image..."` یا `"regenerate random"` را شناسایی کند.
- از محتوای پیام یا history، شماره slot اصلی استخراج شود.
- اگر slot پیدا شد، مسیر deterministic با همان slot فعال شود ولی با تنوع در prompt (مثلاً اضافه‌کردن `unique variation`, `different angle/composition` به imagePrompt) تا تصویر غیرتکراری تولید شود.
- لوگوی شرکت دقیقاً مثل تولید اولیه اعمال می‌شود.

#### 2. تغییر فرانت برای ارسال اطلاعات slot در Regenerate (فایل: `src/pages/AgentWorkspace.tsx`)
- `handleRegeneratePost` تغییر کند تا شماره slot را از caption/id پست استخراج و در پیام ارسال کند (مثلاً `"regenerate slot 2"`).
- `handleRegenerateImage` هم به‌جای `"regenerate random"` پیام مشخص‌تری ارسال کند.

#### 3. بهبود فیلد «متن روی عکس» در ترجمه فارسی (فایل: `supabase/functions/ai-agent/index.ts`)
- در ساخت `persianBlock`، اگر `slot.imageTextFa` خالی یا `"-"` بود، سطر `🖼️ متن روی عکس:` اصلاً نمایش داده نشود.

---

### جزئیات فنی

**بک‌اند — شناسایی regenerate (ai-agent/index.ts):**

```text
قبل از بخش deterministic فعلی (خط ~416):
- الگوی جدید: /regenerate\s*(slot\s*)?(\d)/i
- اگر مطابقت داشت → slot را استخراج → PIXEL_SLOTS[slot-1] را بگیر
- به imagePrompt عبارت تنوع اضافه شود:
  "Create a COMPLETELY DIFFERENT and UNIQUE variation — different camera angle,
   different composition, different lighting, different arrangement of [product]"
- سپس generatePixelImage را با logoUrl صدا بزن (دقیقاً مثل مسیر اصلی)
```

**فرانت — ارسال slot در regenerate (AgentWorkspace.tsx):**

```text
handleRegeneratePost:
  - از post.id یا post.caption الگوی "Slot X" را پیدا کن
  - پیام ارسالی: "regenerate slot X"

handleRegenerateImage:
  - "regenerate slot X" به‌جای "regenerate random"
```

**بک‌اند — ترجمه فارسی بدون متن روی عکس:**

```text
const persianBlock = `\n\n---PERSIAN---\n` +
  (slot.imageTextFa ? `🖼️ متن روی عکس: ${slot.imageTextFa}\n` : "") +
  `📝 ترجمه کپشن: ${slot.captionFa}`;
```

---

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `supabase/functions/ai-agent/index.ts` | شناسایی regenerate + مسیر deterministic با تنوع + لوگو + فیلتر imageTextFa خالی |
| `src/pages/AgentWorkspace.tsx` | ارسال شماره slot در پیام regenerate |

