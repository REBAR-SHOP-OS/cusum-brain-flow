

# اصلاح عناوین Vizzy Brain — تطبیق دقیق با لیست کاربر

## مشکل
عناوین فعلی Brain دقیقاً مطابق لیست درخواستی نیست. کاربر لیست مشخصی داده:

```
Dashboard, Inbox, Team Hub, Business Tasks, Live Monitor, CEO Portal,
Support, Pipeline, Lead Scoring, Customers, Accounting, Sales,
Production, Shop Floor, Time Clock, Office Tools
```

تفاوت‌ها با وضع فعلی:
- "Pipeline & Leads" باید به دو بخش جدا تقسیم شود: **Pipeline** و **Lead Scoring**
- **Sales** وجود ندارد
- **Production** به‌عنوان گروه جداگانه وجود ندارد (فقط Shop Floor هست)
- **Office Tools** وجود ندارد
- ترتیب نمایش باید دقیقاً مطابق لیست باشد
- **همه بخش‌ها باید همیشه نمایش داده شوند** (حتی اگر داده‌ای نداشته باشند)

## تغییرات

### فایل: `src/components/vizzy/VizzyBrainPanel.tsx`

1. **بازنویسی `SIDEBAR_GROUPS`** با ترتیب و نام‌های دقیق:

```typescript
const SIDEBAR_GROUPS = [
  { key: "dashboard",    label: "📊 Dashboard",      categories: ["brain_insight", "general", "benchmark", "daily_benchmark"] },
  { key: "inbox",        label: "📥 Inbox",           categories: ["email"] },
  { key: "team_hub",     label: "💬 Team Hub",        categories: ["feedback_clarification", "feedback_patch"] },
  { key: "tasks",        label: "📋 Business Tasks",  categories: ["auto_fix", "feedback_fix"] },
  { key: "monitor",      label: "📡 Live Monitor",    categories: ["agent_audit", "pre_digest"] },
  { key: "ceo",          label: "🏢 CEO Portal",      categories: ["business"] },
  { key: "support",      label: "🎧 Support",         categories: ["feedback_escalation", "call_summary", "voicemail_summary"] },
  { key: "pipeline",     label: "📈 Pipeline",        categories: ["leads"] },
  { key: "lead_scoring", label: "🎯 Lead Scoring",    categories: ["lead_scoring"] },
  { key: "customers",    label: "👥 Customers",       categories: ["crm"] },
  { key: "accounting",   label: "💰 Accounting",      categories: ["accounting"] },
  { key: "sales",        label: "🛒 Sales",           categories: ["sales", "orders"] },
  { key: "production",   label: "🏭 Production",      categories: ["production"] },
  { key: "shop_floor",   label: "🔧 Shop Floor",      categories: ["shop_floor"] },
  { key: "timeclock",    label: "⏰ Time Clock",      categories: ["timeclock"] },
  { key: "office_tools", label: "🛠️ Office Tools",    categories: ["office_tools"] },
];
```

2. **حذف فیلتر گروه‌های خالی** — خط `.filter(...)` برداشته شود تا همه بخش‌ها همیشه نمایش داده شوند، با نمایش "No data yet" برای بخش‌های بدون داده.

3. **اضافه کردن پیام خالی** — وقتی گروهی ورودی ندارد، به‌جای مخفی شدن، متن `No insights yet` نمایش داده شود.

### فایل: `src/hooks/useVizzyMemory.ts`
بدون تغییر.

### نتیجه
- دقیقاً ۱۶ بخش مطابق لیست کاربر
- همه بخش‌ها همیشه قابل مشاهده
- بخش‌های بدون داده با پیام مناسب

