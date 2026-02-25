

## دو اصلاح: حذف عنوان اسلات از کپشن + اطمینان از نمایش ترجمه فارسی

### مشکل اول: عنوان اسلات در کپشن و content
خط `### Slot 1 — 06:30 AM | Rebar Stirrups` بخشی از خروجی markdown ایجنت است و در `extractPostData` حذف نمی‌شود. این باعث می‌شود:
- در کارت پست Pixel، کپشن با این عنوان شروع شود
- در `social_posts.title` این متن ذخیره شود
- در `social_posts.content` هم تکرار شود

### مشکل دوم: ترجمه فارسی
کد فعلی `PixelPostCard` و `PixelChatRenderer` از نظر ساختاری درست هستند — `persianTranslation` جدا شده و نمایش داده می‌شود. اما اگر ایجنت `---PERSIAN---` separator را تولید نکند، ترجمه فارسی داخل caption اصلی می‌ماند. باید مطمئن شویم prompt به درستی این separator را الزامی کرده.

---

### تغییرات

#### 1. `src/components/social/PixelChatRenderer.tsx` — حذف خطوط Slot header

در تابع `extractPostData`، بعد از حذف image markdown، خطوطی که با `### Slot` یا `## Slot` شروع می‌شوند حذف شوند:

```
textContent = textContent.replace(/^#{1,4}\s*Slot\s*\d+\s*[—\-].*/gm, "");
```

این regex تمام خطوط header مثل `### Slot 1 — 06:30 AM | Rebar Stirrups` را حذف می‌کند.

همچنین خطوط `**Caption:**` و `**Hashtags:**` را هم حذف می‌کنیم:
```
textContent = textContent.replace(/\*\*Caption:\*\*/g, "");
textContent = textContent.replace(/\*\*Hashtags:\*\*/g, "");
```

#### 2. `src/pages/AgentWorkspace.tsx` — تمیزکردن title هنگام ذخیره

در `handleApprovePost`، فیلد `title` باید از اولین خط معنادار caption (بدون slot header) ساخته شود. یک تابع کمکی اضافه می‌شود که اولین خط غیرخالی و غیر-slot-header را پیدا کند:

```typescript
// Clean caption: remove slot headers before saving
const cleanCaption = (post.caption || "")
  .replace(/^#{1,4}\s*Slot\s*\d+\s*[—\-].*$/gm, "")
  .replace(/\*\*Caption:\*\*/g, "")
  .replace(/\*\*Hashtags:\*\*/g, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const title = cleanCaption.split("\n").find(l => l.trim().length > 0)?.slice(0, 80) || "Pixel Post";
```

و `content` هم از `cleanCaption` استفاده کند.

#### 3. `supabase/functions/_shared/agents/marketing.ts` — تقویت دستور ترجمه فارسی

بررسی prompt نشان می‌دهد که separator `---PERSIAN---` قبلاً در prompt تعریف شده. اما باید مطمئن شویم که AI همیشه آن را تولید می‌کند. یک جمله تاکیدی اضافه می‌شود:
- "The `---PERSIAN---` separator is MANDATORY in every response that contains a generated image"

---

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `src/components/social/PixelChatRenderer.tsx` | حذف خطوط Slot header و markdown formatting از caption |
| `src/pages/AgentWorkspace.tsx` | تمیزکردن caption قبل از ذخیره در social_posts |
| `supabase/functions/_shared/agents/marketing.ts` | تاکید بر الزامی بودن separator فارسی |

