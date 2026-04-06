

# اصلاح نمایش دسته‌بندی‌های Vizzy Brain

## وضعیت فعلی

داده‌ها **واقعی** هستند و مستقیماً از دیتابیس `vizzy_memory` خوانده می‌شوند. هیچ داده فیک یا mock در سیستم وجود ندارد.

مشکل اصلی: دسته‌بندی‌هایی مثل `feedback_fix`، `daily_benchmark`، `business`، `feedback_clarification`، `feedback_escalation` **لیبل فارسی/انگلیسی مناسب ندارند** و به‌صورت خام نمایش داده می‌شوند که ظاهر غیرحرفه‌ای و ناشناخته‌ای ایجاد می‌کند.

## تغییرات

### فایل: `src/components/vizzy/VizzyBrainPanel.tsx`

`CATEGORY_LABELS` را کامل می‌کنم تا همه دسته‌بندی‌های موجود در دیتابیس لیبل مناسب داشته باشند:

```typescript
const CATEGORY_LABELS: Record<string, string> = {
  brain_insight: "🧠 Insights",
  general: "📌 General",
  benchmark: "📊 Benchmarks",
  daily_benchmark: "📊 Daily Benchmarks",
  call_summary: "📞 Calls",
  voicemail_summary: "📩 Voicemails",
  agent_audit: "🤖 Agent Audits",
  auto_fix: "🔧 Auto-Fixes",
  feedback_patch: "📝 Feedback Patches",
  feedback_fix: "🔧 Feedback Fixes",
  feedback_clarification: "💬 Clarifications",
  feedback_escalation: "🚨 Escalations",
  business: "💼 Business",
  pre_digest: "📋 Digests",
};
```

### فایل: `src/hooks/useVizzyMemory.ts` — تقویت پرامپت Analyze

پرامپت `analyzeSystem` را اصلاح می‌کنم تا AI صریحاً دستور داشته باشد **فقط بر اساس داده‌های واقعی** بنویسد و هیچ عدد یا اطلاعات فرضی تولید نکند:

```
"... Only report facts you can confirm from the provided context.
 Do NOT fabricate numbers, names, or events. 
 If data is unavailable, say 'Data not available' instead of guessing."
```

**نتیجه:** تمام دسته‌بندی‌ها با لیبل مناسب نمایش داده می‌شوند و AI از ساخت اطلاعات فیک منع می‌شود.

