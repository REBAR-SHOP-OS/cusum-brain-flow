

## دکمه خلاصه حرفه‌ای گزارش‌های تیمی

### هدف
اضافه کردن یک آیکون (Sparkles ✨) در هدر دیالوگ Team Reports که وقتی کلیک می‌شود، تمام گزارش‌های موجود را جمع‌آوری کرده و با استفاده از AI یک خلاصه حرفه‌ای تولید می‌کند.

### تغییرات

**فایل: `src/components/agent/EisenhowerTeamReportDialog.tsx`**

1. اضافه کردن state های جدید: `summaryLoading`, `summaryText`, `showSummary`
2. اضافه کردن دکمه آیکون `Sparkles` در کنار عنوان دیالوگ (فقط در صفحه اصلی لیست کارمندان)
3. تابع `generateSummary`:
   - تمام `last_report` های موجود از همه کارمندان را جمع‌آوری می‌کند
   - با `supabase.functions.invoke("ai-generic")` و یک system prompt حرفه‌ای، خلاصه تولید می‌کند
   - خلاصه را در `summaryText` ذخیره و نمایش می‌دهد
4. وقتی `showSummary=true`، به جای لیست کارمندان، خلاصه حرفه‌ای با `RichMarkdown` نمایش داده می‌شود
5. دکمه Back برای بازگشت از خلاصه به لیست کارمندان

### System Prompt برای AI
```
You are a professional executive report writer. Given multiple Eisenhower Matrix reports from different team members, create a concise executive summary that includes:
1. Overall team workload assessment
2. Critical items across the team (Q1 - Do Now)
3. Strategic priorities (Q2 - Schedule)
4. Delegation opportunities (Q3)
5. Items to eliminate (Q4)
6. Key recommendations for management
Write in professional English. Be concise and actionable.
```

### UX Flow
```text
[Team Reports]  [✨ icon]
   │                │
   │                └─→ Loading spinner → AI Summary view (with Back button)
   │
   └─→ Employee list → Sessions → Report detail
```

### فایل درگیر
- `src/components/agent/EisenhowerTeamReportDialog.tsx` (تنها فایل)

