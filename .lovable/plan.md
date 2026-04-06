

# تغییر دسته‌بندی Vizzy Brain مطابق منوی سایدبار

## مشکل
دسته‌بندی‌های فعلی Brain (Clarifications, Business, Feedback Fixes, Insights, Escalations) با ساختار منوی اصلی اپلیکیشن همخوانی ندارد. کاربر می‌خواهد دسته‌بندی‌ها دقیقاً مطابق بخش‌های سایدبار باشد.

## نقشه‌بندی جدید

دسته‌بندی‌های موجود در دیتابیس را به بخش‌های سایدبار مپ می‌کنیم:

```text
سایدبار                    ←  دسته‌بندی‌های دیتابیس
─────────────────────────────────────────────────
📊 Dashboard               ←  brain_insight, general, benchmark, daily_benchmark
📥 Inbox                   ←  email
💬 Team Hub                ←  feedback_clarification, feedback_patch
📋 Business Tasks          ←  auto_fix, feedback_fix
📡 Live Monitor            ←  agent_audit, pre_digest
🏢 CEO Portal              ←  business
🎧 Support                 ←  feedback_escalation, call_summary, voicemail_summary
📈 Pipeline                ←  leads
🎯 Lead Scoring            ←  leads (merged with Pipeline)
👥 Customers               ←  crm, orders
💰 Accounting              ←  accounting
📈 Sales                   ←  (sales-related entries)
🏭 Shop Floor (Production) ←  production
⏰ Time Clock              ←  timeclock
🛠️ Office Tools            ←  (general tools)
```

## تغییرات

### فایل: `src/components/vizzy/VizzyBrainPanel.tsx`

1. **تغییر `CATEGORY_LABELS`** — لیبل‌ها مطابق نام‌های سایدبار
2. **اضافه کردن `CATEGORY_GROUP_MAP`** — هر category دیتابیس به یک گروه سایدبار مپ می‌شود
3. **تغییر grouping logic** — به‌جای گروه‌بندی بر اساس `category` خام، بر اساس گروه سایدبار دسته‌بندی شود

```typescript
const SIDEBAR_GROUPS: Record<string, { label: string; categories: string[] }> = {
  dashboard:    { label: "📊 Dashboard",       categories: ["brain_insight", "general", "benchmark", "daily_benchmark"] },
  inbox:        { label: "📥 Inbox",            categories: ["email"] },
  team_hub:     { label: "💬 Team Hub",         categories: ["feedback_clarification", "feedback_patch"] },
  tasks:        { label: "📋 Business Tasks",   categories: ["auto_fix", "feedback_fix"] },
  monitor:      { label: "📡 Live Monitor",     categories: ["agent_audit", "pre_digest"] },
  ceo:          { label: "🏢 CEO Portal",       categories: ["business"] },
  support:      { label: "🎧 Support",          categories: ["feedback_escalation", "call_summary", "voicemail_summary"] },
  pipeline:     { label: "📈 Pipeline & Leads", categories: ["leads"] },
  customers:    { label: "👥 Customers",        categories: ["crm", "orders"] },
  accounting:   { label: "💰 Accounting",       categories: ["accounting"] },
  shop_floor:   { label: "🏭 Shop Floor",       categories: ["production"] },
  timeclock:    { label: "⏰ Time Clock",       categories: ["timeclock"] },
};
```

4. **تغییر `useMemo` گروه‌بندی** — entries را بر اساس `SIDEBAR_GROUPS` گروه‌بندی کنم (نه بر اساس category خام). دسته‌هایی که ورودی ندارند نمایش داده نمی‌شوند.

### فایل: `src/hooks/useVizzyMemory.ts`
بدون تغییر — ساختار ذخیره‌سازی همان می‌ماند، فقط نمایش تغییر می‌کند.

### نتیجه
- دسته‌بندی‌های Brain دقیقاً مطابق منوی سایدبار
- چند category مرتبط در یک گروه ادغام می‌شوند
- ترتیب نمایش مطابق ترتیب سایدبار

