

## اصلاح پاسخ آیزنهاور + افزودن دکمه ترجمه

### مشکل ۱: پاسخ آیزنهاور بر اساس ایمیل‌ها و تماس‌ها
الان ایجنت آیزنهاور اطلاعات ایمیل‌ها، مشتری‌ها و پروژه‌ها را دریافت می‌کند و از آن‌ها در ماتریس استفاده می‌کند، در حالی که فقط باید بر اساس آنچه کاربر در چت نوشته تحلیل کند.

### مشکل ۲: ترجمه پاسخ
گزارش نهایی آیزنهاور به انگلیسی نوشته می‌شود و کاربر ممکن است بخواهد آن را به زبان خودش بخواند.

---

### تغییرات

#### ۱. `supabase/functions/_shared/agentContext.ts`
در بخش ابتدایی (خطوط ۲۶-۴۵)، ایجنت `eisenhower` را به شرط skip اضافه می‌کنیم تا مانند `social` از دریافت ایمیل‌ها و مشتری‌ها صرف‌نظر کند:

```typescript
if (agent === "social" || agent === "eisenhower") {
  // Skip heavy communications context
} else {
  // ... existing email/customer fetches
}
```

#### ۲. `supabase/functions/_shared/agents/growth.ts`
پرامت آیزنهاور را اصلاح می‌کنیم تا صریحاً بگوید **فقط** از تسک‌هایی که کاربر در چت نوشته استفاده کند و از اطلاعات context مانند ایمیل‌ها استفاده نکند:

اضافه کردن به بخش Rules:
```
- ONLY analyze tasks that the user has explicitly typed in this chat session
- Do NOT use context data like emails, missed calls, projects, or customer info to generate tasks
- If the user hasn't listed tasks yet, ask them to do so. Never auto-generate tasks from system context.
```

#### ۳. `src/components/chat/MessageActions.tsx`
افزودن دکمه ترجمه (🌐 Translate) به لیست اکشن‌ها:
- با کلیک، یک دیالوگ/منو با لیست زبان‌ها نمایش داده شود (فارسی، عربی، ترکی، اسپانیایی، فرانسوی، آلمانی و ...)
- با انتخاب زبان، edge function `translate-message` فراخوانی شود
- متن ترجمه‌شده در یک بلاک جدید زیر پیام اصلی نمایش داده شود

#### ۴. `src/components/chat/ChatMessage.tsx`
- state برای نمایش متن ترجمه‌شده اضافه شود
- بعد از bubble اصلی، اگر ترجمه وجود داشته باشد، یک بلاک ترجمه با پس‌زمینه متفاوت و لیبل زبان نمایش داده شود
- callback `onTranslate` را از `MessageActions` دریافت کند

### فایل‌های درگیر
- `supabase/functions/_shared/agentContext.ts` — skip context برای eisenhower
- `supabase/functions/_shared/agents/growth.ts` — اصلاح پرامت
- `src/components/chat/MessageActions.tsx` — افزودن دکمه ترجمه
- `src/components/chat/ChatMessage.tsx` — نمایش متن ترجمه‌شده

